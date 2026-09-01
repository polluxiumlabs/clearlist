from __future__ import annotations

import asyncio
import csv
import io
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel

from app.config import settings
from app.database.firestore import contact_messages, upload_metadata
from app.storage.b2 import b2_storage
from app.verification.service import verification_service
from app.verification.syntax import normalize_email

router = APIRouter(prefix="/api/admin", tags=["admin"])


def verify_admin(x_admin_token: str = Header(..., alias="X-Admin-Token")) -> None:
    if not settings.admin_enabled:
        raise HTTPException(status_code=503, detail="Admin access is not configured on the server")
    if x_admin_token.strip() != settings.admin_secret_key:
        raise HTTPException(status_code=401, detail="Invalid admin authentication token")


class CleanCsvPayload(BaseModel):
    csv_content: str


@router.post("/verify", dependencies=[Depends(verify_admin)])
async def verify_token() -> dict[str, str]:
    return {"status": "authorized", "message": "Admin token is valid"}


@router.get("/stats", dependencies=[Depends(verify_admin)])
async def get_admin_stats() -> dict[str, Any]:
    uploads = await asyncio.to_thread(upload_metadata.list_all_uploads) if upload_metadata.enabled else []
    messages = await asyncio.to_thread(contact_messages.list_all_messages) if contact_messages.enabled else []
    
    total_size_bytes = sum(int(u.get("sizeBytes", 0)) for u in uploads)
    active_uploads = [u for u in uploads if u.get("status") == "stored"]
    
    return {
        "total_uploads": len(uploads),
        "active_uploads": len(active_uploads),
        "total_storage_bytes": total_size_bytes,
        "total_messages": len(messages),
        "storage_enabled": b2_storage.enabled,
        "database_enabled": upload_metadata.enabled,
    }


@router.get("/uploads", dependencies=[Depends(verify_admin)])
async def list_uploads() -> list[dict[str, Any]]:
    if not upload_metadata.enabled:
        raise HTTPException(status_code=503, detail="Firestore database is not configured")
    
    uploads = await asyncio.to_thread(upload_metadata.list_all_uploads)
    # Format datetime objects for JSON serialization
    serialized = []
    for item in uploads:
        row = dict(item)
        for key in ("createdAt", "expiresAt", "deletedAt", "cleanedAt"):
            if isinstance(row.get(key), datetime):
                row[key] = row[key].isoformat()
        serialized.append(row)
    return serialized


@router.get("/uploads/{upload_id}/download-original", dependencies=[Depends(verify_admin)])
async def download_original_csv(upload_id: str) -> Response:
    if not b2_storage.enabled:
        raise HTTPException(status_code=503, detail="Backblaze B2 storage is not configured")
    
    try:
        data = await asyncio.to_thread(b2_storage.get_csv, upload_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Original CSV file not found in storage") from exc

    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="original-{upload_id}.csv"'},
    )


@router.get("/uploads/{upload_id}/download-clean", dependencies=[Depends(verify_admin)])
async def download_clean_csv(upload_id: str) -> Response:
    if not b2_storage.enabled:
        raise HTTPException(status_code=503, detail="Backblaze B2 storage is not configured")
    
    # 1. Check if clean CSV already pre-stored (and has actual data rows with Status column)
    clean_data = await asyncio.to_thread(b2_storage.get_clean_csv, upload_id)
    if clean_data is not None and len(clean_data.strip()) > 20 and b"\n" in clean_data.strip():
        text_preview = clean_data.decode("utf-8-sig", errors="replace")
        lines = [l for l in text_preview.splitlines() if l.strip()]
        if len(lines) > 1 and any("status" in col.lower() for col in lines[0].split(",")):
            return Response(
                content=clean_data,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="cleanup-{upload_id}.csv"'},
            )
    
    # 2. Otherwise generate cleaned CSV on-the-fly from original
    try:
        raw_data = await asyncio.to_thread(b2_storage.get_csv, upload_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="CSV file not found in storage") from exc

    text = raw_data.decode("utf-8-sig", errors="replace")
    raw_lines = [line for line in text.splitlines() if line.strip()]
    if not raw_lines:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    reader = csv.reader(raw_lines)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    rows_list = list(reader)

    # Locate email header
    email_idx = -1
    for idx, header in enumerate(headers):
        h = re.sub(r"[\W_]+", " ", header.strip().lower()).strip()
        if any(term in h for term in ("email", "e mail", "mail", "contact email", "primary email", "work email")):
            email_idx = idx
            break

    # Fallback: inspect sample rows to find which column holds email addresses
    if email_idx == -1:
        for idx in range(len(headers)):
            for row in rows_list[:20]:
                if len(row) > idx and "@" in row[idx] and normalize_email(row[idx]):
                    email_idx = idx
                    break
            if email_idx != -1:
                break

    if email_idx == -1:
        email_idx = 0

    clean_rows = [headers + ["Status", "Reason"]]
    seen_emails: set[str] = set()
    candidate_rows: list[tuple[list[str], str]] = []

    for row in rows_list:
        if not row or len(row) <= email_idx:
            continue
        raw_email = row[email_idx].strip()
        normalized = normalize_email(raw_email)
        if not normalized or normalized in seen_emails:
            continue
        seen_emails.add(normalized)
        candidate_rows.append((row, normalized))

    if candidate_rows:
        results = await asyncio.gather(*(verification_service.verify(email) for _, email in candidate_rows))
        for (orig_row, norm_email), result in zip(candidate_rows, results):
            if result.status == "valid":
                cleaned_row = list(orig_row)
                cleaned_row[email_idx] = norm_email
                clean_rows.append(cleaned_row + [result.status, result.reason])

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerows(clean_rows)
    generated_bytes = out.getvalue().encode("utf-8-sig")

    # Cache cleaned version in B2
    try:
        await asyncio.to_thread(b2_storage.put_clean_csv, upload_id, generated_bytes)
        if upload_metadata.enabled:
            await asyncio.to_thread(upload_metadata.mark_cleaned, upload_id, len(generated_bytes))
    except Exception:
        pass

    return Response(
        content=generated_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cleanup-{upload_id}.csv"'},
    )


@router.post("/uploads/{upload_id}/clean", dependencies=[Depends(verify_admin)])
async def store_clean_csv(upload_id: str, payload: CleanCsvPayload) -> dict[str, Any]:
    if not b2_storage.enabled:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    clean_bytes = payload.csv_content.encode("utf-8-sig")
    await asyncio.to_thread(b2_storage.put_clean_csv, upload_id, clean_bytes)
    if upload_metadata.enabled:
        await asyncio.to_thread(upload_metadata.mark_cleaned, upload_id, len(clean_bytes))
    return {"status": "stored", "sizeBytes": len(clean_bytes)}


class BatchDeleteUploadsPayload(BaseModel):
    upload_ids: list[str]


@router.post("/uploads/batch-delete", dependencies=[Depends(verify_admin)])
async def batch_delete_uploads(payload: BatchDeleteUploadsPayload) -> dict[str, Any]:
    deleted = []
    for upload_id in payload.upload_ids:
        if b2_storage.enabled:
            try:
                await asyncio.to_thread(b2_storage.delete_all_csv_versions, upload_id)
            except Exception:
                pass
        if upload_metadata.enabled:
            try:
                await asyncio.to_thread(upload_metadata.delete_record, upload_id)
            except Exception:
                pass
        deleted.append(upload_id)
    return {"status": "deleted", "deleted_count": len(deleted), "upload_ids": deleted}


@router.delete("/uploads/{upload_id}", dependencies=[Depends(verify_admin)])
async def admin_delete_upload(upload_id: str) -> dict[str, str]:
    if b2_storage.enabled:
        try:
            await asyncio.to_thread(b2_storage.delete_all_csv_versions, upload_id)
        except Exception:
            pass
    
    if upload_metadata.enabled:
        try:
            await asyncio.to_thread(upload_metadata.delete_record, upload_id)
        except Exception:
            pass

    return {"status": "deleted", "upload_id": upload_id}


@router.get("/messages", dependencies=[Depends(verify_admin)])
async def list_contact_messages() -> list[dict[str, Any]]:
    if not contact_messages.enabled:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    messages = await asyncio.to_thread(contact_messages.list_all_messages)
    serialized = []
    for item in messages:
        row = dict(item)
        if isinstance(row.get("submittedAt"), datetime):
            row["submittedAt"] = row["submittedAt"].isoformat()
        serialized.append(row)
    return serialized


class BatchDeleteMessagesPayload(BaseModel):
    message_ids: list[str]


@router.delete("/messages/{message_id}", dependencies=[Depends(verify_admin)])
async def delete_contact_message(message_id: str) -> dict[str, str]:
    if contact_messages.enabled:
        try:
            await asyncio.to_thread(contact_messages.delete_message, message_id)
        except Exception:
            pass
    return {"status": "deleted", "message_id": message_id}


@router.post("/messages/batch-delete", dependencies=[Depends(verify_admin)])
async def batch_delete_messages(payload: BatchDeleteMessagesPayload) -> dict[str, Any]:
    deleted = []
    if contact_messages.enabled:
        for message_id in payload.message_ids:
            try:
                await asyncio.to_thread(contact_messages.delete_message, message_id)
                deleted.append(message_id)
            except Exception:
                pass
    return {"status": "deleted", "deleted_count": len(deleted), "message_ids": deleted}
