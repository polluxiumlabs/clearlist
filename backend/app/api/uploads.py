from __future__ import annotations

import asyncio
import csv
import io
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.config import settings
from app.database.firestore import upload_metadata
from app.storage.b2 import b2_storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


class StoredUpload(BaseModel):
    upload_id: str
    deletion_token: str
    expires_at: datetime


def _validate_csv(body: bytes) -> None:
    try:
        text = body.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="The CSV must use UTF-8 text encoding") from exc

    try:
        reader = csv.reader(io.StringIO(text))
        headers = next(reader)
    except (csv.Error, StopIteration) as exc:
        raise HTTPException(status_code=400, detail="The CSV is empty or malformed") from exc

    normalized = {re.sub(r"[_-]+", " ", value.strip().lower()) for value in headers}
    if not normalized.intersection({"email", "email address", "e mail", "mail"}):
        raise HTTPException(status_code=400, detail="The CSV needs an Email or Email Address column")


@router.post("", response_model=StoredUpload, status_code=status.HTTP_201_CREATED)
async def upload_csv(file: UploadFile = File(...)) -> StoredUpload:
    if not b2_storage.enabled:
        raise HTTPException(status_code=503, detail="Private CSV storage is not configured")
    if not upload_metadata.enabled:
        raise HTTPException(status_code=503, detail="Firebase upload metadata is not configured")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    body = await file.read(settings.max_csv_bytes + 1)
    await file.close()
    if len(body) > settings.max_csv_bytes:
        raise HTTPException(status_code=413, detail="The CSV exceeds the storage size limit")
    _validate_csv(body)

    upload_id = uuid.uuid4().hex
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=settings.csv_retention_hours)
    try:
        await asyncio.to_thread(b2_storage.put_csv, upload_id, body)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The encrypted storage service is temporarily unavailable") from exc

    try:
        await asyncio.to_thread(
            upload_metadata.create_upload,
            upload_id=upload_id,
            object_key=b2_storage.object_key(upload_id),
            size_bytes=len(body),
            created_at=created_at,
            expires_at=expires_at,
        )
    except Exception as exc:
        try:
            await asyncio.to_thread(b2_storage.delete_csv, upload_id)
        except Exception:
            pass
        raise HTTPException(status_code=503, detail="The upload database is temporarily unavailable") from exc

    return StoredUpload(
        upload_id=upload_id,
        deletion_token=b2_storage.deletion_token(upload_id),
        expires_at=expires_at,
    )


@router.delete("/{upload_id}")
async def delete_csv(upload_id: str, x_delete_token: str = Header(...)) -> dict[str, str]:
    if not re.fullmatch(r"[a-f0-9]{32}", upload_id) or not b2_storage.token_is_valid(upload_id, x_delete_token):
        raise HTTPException(status_code=404, detail="Stored CSV not found")
    try:
        await asyncio.to_thread(b2_storage.delete_csv, upload_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The stored CSV could not be deleted right now") from exc
    if upload_metadata.enabled:
        try:
            await asyncio.to_thread(upload_metadata.mark_deleted, upload_id, datetime.now(timezone.utc))
        except Exception as exc:
            raise HTTPException(status_code=503, detail="The file was deleted, but its database record could not be updated") from exc
    return {"status": "deleted"}
