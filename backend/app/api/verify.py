import asyncio

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.verification.result import VerificationResult
from app.verification.service import verification_service

router = APIRouter(prefix="/api", tags=["verification"])


class BatchRequest(BaseModel):
    emails: list[str] = Field(min_length=1)

    @field_validator("emails")
    @classmethod
    def validate_batch(cls, value: list[str]) -> list[str]:
        if len(value) > settings.max_batch_size:
            raise ValueError(f"A batch may contain at most {settings.max_batch_size} emails")
        if any(len(email) > 320 for email in value):
            raise ValueError("An email address may not exceed 320 characters")
        return value


class BatchResponse(BaseModel):
    results: list[VerificationResult]


@router.post("/verify-batch", response_model=BatchResponse)
async def verify_batch(payload: BatchRequest) -> BatchResponse:
    results = await asyncio.gather(*(verification_service.verify(email) for email in payload.emails))
    return BatchResponse(results=list(results))
