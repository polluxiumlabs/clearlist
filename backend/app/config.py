import os
from dataclasses import dataclass


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    max_batch_size: int = int(os.getenv("MAX_BATCH_SIZE", "500"))
    global_concurrency: int = int(os.getenv("GLOBAL_CONCURRENCY", "30"))
    per_domain_concurrency: int = int(os.getenv("PER_DOMAIN_CONCURRENCY", "3"))
    dns_timeout_seconds: float = float(os.getenv("DNS_TIMEOUT_SECONDS", "5"))
    smtp_timeout_seconds: float = float(os.getenv("SMTP_TIMEOUT_SECONDS", "8"))
    cache_ttl_seconds: int = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
    smtp_enabled: bool = _as_bool(os.getenv("SMTP_ENABLED"), False)
    catch_all_enabled: bool = _as_bool(os.getenv("CATCH_ALL_ENABLED"), False)
    max_csv_bytes: int = int(os.getenv("MAX_CSV_BYTES", str(10 * 1024 * 1024)))
    csv_retention_hours: int = int(os.getenv("CSV_RETENTION_HOURS", "24"))
    b2_endpoint: str = os.getenv("B2_ENDPOINT", "").strip()
    b2_region: str = os.getenv("B2_REGION", "").strip()
    b2_bucket: str = os.getenv("B2_BUCKET", "").strip()
    b2_key_id: str = os.getenv("B2_KEY_ID", "").strip()
    b2_application_key: str = os.getenv("B2_APPLICATION_KEY", "").strip()
    upload_token_secret: str = os.getenv("UPLOAD_TOKEN_SECRET", "").strip()
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    )

    @property
    def storage_enabled(self) -> bool:
        return all((self.b2_endpoint, self.b2_region, self.b2_bucket, self.b2_key_id, self.b2_application_key, self.upload_token_secret))


settings = Settings()
