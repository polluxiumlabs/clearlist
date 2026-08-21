from __future__ import annotations

import asyncio
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import settings
from app.database.firestore import contact_messages

router = APIRouter(prefix="/api/contact", tags=["contact"])

_attempts: dict[str, deque[float]] = defaultdict(deque)
_attempts_lock = Lock()


class ContactRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    topic: Literal["support", "privacy", "data-request", "feedback", "other"]
    message: str = Field(min_length=20, max_length=3000)
    company_website: str = Field(default="", max_length=200)
    privacy_accepted: bool

    @field_validator("name", "message")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split()) if "\n" not in value else "\n".join(line.strip() for line in value.strip().splitlines())


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _enforce_rate_limit(request: Request) -> None:
    now = time.monotonic()
    cutoff = now - 3600
    key = _client_key(request)
    with _attempts_lock:
        attempts = _attempts[key]
        while attempts and attempts[0] < cutoff:
            attempts.popleft()
        if len(attempts) >= settings.contact_rate_limit_per_hour:
            raise HTTPException(status_code=429, detail="Too many contact requests. Please try again later.")
        attempts.append(now)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact_message(payload: ContactRequest, request: Request) -> dict[str, str]:
    _enforce_rate_limit(request)

    # Bots commonly fill hidden website fields. Return a normal response without
    # creating a record so the field cannot be used to probe the filter.
    if payload.company_website:
        return {"status": "received"}
    if not payload.privacy_accepted:
        raise HTTPException(status_code=400, detail="Privacy acknowledgement is required")
    if not contact_messages.enabled:
        raise HTTPException(status_code=503, detail="The contact service is not configured")

    try:
        await asyncio.to_thread(
            contact_messages.create_message,
            message_id=uuid.uuid4().hex,
            name=payload.name,
            email=str(payload.email).lower(),
            topic=payload.topic,
            message=payload.message,
            submitted_at=datetime.now(timezone.utc),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The contact service is temporarily unavailable") from exc

    return {"status": "received"}
