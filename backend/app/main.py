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
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["POST", "GET", "DELETE"],
    allow_headers=["Content-Type", "X-Delete-Token", "X-Admin-Token"],
    expose_headers=["Content-Disposition"],
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
