from __future__ import annotations

import base64
import hashlib
import hmac

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.config import settings


class B2Storage:
    def __init__(self) -> None:
        self._client: BaseClient | None = None

    @property
    def enabled(self) -> bool:
        return settings.storage_enabled

    def _get_client(self) -> BaseClient:
        if not self.enabled:
            raise RuntimeError("Private CSV storage is not configured")
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.b2_endpoint,
                region_name=settings.b2_region,
                aws_access_key_id=settings.b2_key_id,
                aws_secret_access_key=settings.b2_application_key,
                config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
            )
        return self._client

    @staticmethod
    def object_key(upload_id: str) -> str:
        return f"uploads/{upload_id}.csv"

    @staticmethod
    def clean_object_key(upload_id: str) -> str:
        return f"uploads/{upload_id}-clean.csv"

    def deletion_token(self, upload_id: str) -> str:
        digest = hmac.new(settings.upload_token_secret.encode(), upload_id.encode(), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(digest).decode().rstrip("=")

    def token_is_valid(self, upload_id: str, candidate: str) -> bool:
        return hmac.compare_digest(self.deletion_token(upload_id), candidate)

    def put_csv(self, upload_id: str, body: bytes) -> None:
        self._get_client().put_object(
            Bucket=settings.b2_bucket,
            Key=self.object_key(upload_id),
            Body=body,
            ContentType="text/csv; charset=utf-8",
            CacheControl="no-store",
            ServerSideEncryption="AES256",
        )

    def get_csv(self, upload_id: str) -> bytes:
        response = self._get_client().get_object(Bucket=settings.b2_bucket, Key=self.object_key(upload_id))
        return response["Body"].read()

    def put_clean_csv(self, upload_id: str, body: bytes) -> None:
        self._get_client().put_object(
            Bucket=settings.b2_bucket,
            Key=self.clean_object_key(upload_id),
            Body=body,
            ContentType="text/csv; charset=utf-8",
            CacheControl="no-store",
            ServerSideEncryption="AES256",
        )

    def get_clean_csv(self, upload_id: str) -> bytes | None:
        try:
            response = self._get_client().get_object(Bucket=settings.b2_bucket, Key=self.clean_object_key(upload_id))
            return response["Body"].read()
        except Exception:
            return None

    def delete_csv(self, upload_id: str) -> None:
        self._get_client().delete_object(Bucket=settings.b2_bucket, Key=self.object_key(upload_id))

    def delete_all_csv_versions(self, upload_id: str) -> None:
        client = self._get_client()
        client.delete_object(Bucket=settings.b2_bucket, Key=self.object_key(upload_id))
        try:
            client.delete_object(Bucket=settings.b2_bucket, Key=self.clean_object_key(upload_id))
        except Exception:
            pass


b2_storage = B2Storage()
