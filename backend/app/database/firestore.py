from __future__ import annotations

from datetime import datetime
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client

from app.config import settings


class UploadMetadataStore:
    """Store non-contact upload metadata in Firestore.

    CSV bytes stay in Backblaze B2. Filenames, email addresses, and CSV rows are
    intentionally excluded from Firestore.
    """

    def __init__(self) -> None:
        self._client: Client | None = None

    @property
    def enabled(self) -> bool:
        return settings.database_enabled

    def _get_client(self) -> Client:
        if not self.enabled:
            raise RuntimeError("Firebase is not configured")
        if self._client is None:
            app_name = f"clearlist-{settings.firebase_project_id}"
            try:
                app = firebase_admin.get_app(app_name)
            except ValueError:
                certificate = credentials.Certificate(
                    {
                        "type": "service_account",
                        "project_id": settings.firebase_project_id,
                        "private_key": settings.firebase_private_key,
                        "client_email": settings.firebase_client_email,
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                )
                app = firebase_admin.initialize_app(
                    certificate,
                    {"projectId": settings.firebase_project_id},
                    name=app_name,
                )
            self._client = firestore.client(app=app, database_id=settings.firebase_database_id)
        return self._client

    @staticmethod
    def _document_data(
        *,
        upload_id: str,
        object_key: str,
        size_bytes: int,
        created_at: datetime,
        expires_at: datetime,
    ) -> dict[str, Any]:
        return {
            "uploadId": upload_id,
            "bucketProvider": "backblaze-b2",
            "objectKey": object_key,
            "contentType": "text/csv; charset=utf-8",
            "sizeBytes": size_bytes,
            "status": "stored",
            "createdAt": created_at,
            "expiresAt": expires_at,
        }

    def create_upload(
        self,
        *,
        upload_id: str,
        object_key: str,
        size_bytes: int,
        created_at: datetime,
        expires_at: datetime,
    ) -> None:
        self._get_client().collection("csv_uploads").document(upload_id).create(
            self._document_data(
                upload_id=upload_id,
                object_key=object_key,
                size_bytes=size_bytes,
                created_at=created_at,
                expires_at=expires_at,
            )
        )

    def mark_deleted(self, upload_id: str, deleted_at: datetime) -> None:
        self._get_client().collection("csv_uploads").document(upload_id).set(
            {"status": "deleted", "deletedAt": deleted_at},
            merge=True,
        )


class ContactMessageStore:
    """Store contact requests for the site owner without client-side access."""

    @property
    def enabled(self) -> bool:
        return settings.database_enabled

    def create_message(
        self,
        *,
        message_id: str,
        name: str,
        email: str,
        topic: str,
        message: str,
        submitted_at: datetime,
    ) -> None:
        upload_metadata._get_client().collection("contact_messages").document(message_id).create(
            {
                "messageId": message_id,
                "name": name,
                "email": email,
                "topic": topic,
                "message": message,
                "status": "new",
                "source": "website-contact-form",
                "submittedAt": submitted_at,
            }
        )


upload_metadata = UploadMetadataStore()
contact_messages = ContactMessageStore()
