from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.verify import router as verification_router
from app.api.uploads import router as uploads_router
from app.api.contact import router as contact_router
from app.api.admin import router as admin_router
from app.config import settings

app = FastAPI(
    title="Clearlist Verification API",
    version="1.0.0",
    description="Email verification with optional short-retention encrypted CSV storage.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins) if settings.cors_origins else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://[a-zA-Z0-9_-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.include_router(verification_router)
app.include_router(uploads_router)
app.include_router(contact_router)
app.include_router(admin_router)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "storage": settings.storage_enabled,
        "database": settings.database_enabled,
        "admin": settings.admin_enabled,
    }
