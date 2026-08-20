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
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    )


settings = Settings()
