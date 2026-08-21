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
    
    # 1. Check if clean CSV already pre-stored
    clean_data = await asyncio.to_thread(b2_storage.get_clean_csv, upload_id)
    if clean_data is not None:
        return Response(
            content=clean_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="cleaned-{upload_id}.csv"'},
        )
    
    # 2. Otherwise generate cleaned CSV on-the-fly from original
    try:
        raw_data = await asyncio.to_thread(b2_storage.get_csv, upload_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="CSV file not found in storage") from exc

    text = raw_data.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    # Locate headers
    email_idx = -1
    name_idx = -1
    title_idx = -1
    org_idx = -1
    for idx, header in enumerate(headers):
        h = re.sub(r"[_-]+", " ", header.strip().lower())
        if h in ("email", "email address", "e mail", "mail") and email_idx == -1:
            email_idx = idx
        elif h in ("name", "full name", "contact name") and name_idx == -1:
            name_idx = idx
        elif h in ("title", "job title", "role") and title_idx == -1:
            title_idx = idx
        elif h in ("company", "organization", "org") and org_idx == -1:
            org_idx = idx

    if email_idx == -1:
        email_idx = 0

    clean_rows = [["Name", "Title", "Organization", "Email"]]
    seen_emails: set[str] = set()

    for row in reader:
        if not row or len(row) <= email_idx:
            continue
        raw_email = row[email_idx].strip()
        normalized = normalize_email(raw_email)
        if not normalized or normalized in seen_emails:
            continue
        
        seen_emails.add(normalized)
        name = row[name_idx].strip() if name_idx != -1 and len(row) > name_idx else ""
        title = row[title_idx].strip() if title_idx != -1 and len(row) > title_idx else ""
        org = row[org_idx].strip() if org_idx != -1 and len(row) > org_idx else ""
        clean_rows.append([name, title, org, normalized])

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
        headers={"Content-Disposition": f'attachment; filename="cleaned-{upload_id}.csv"'},
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
