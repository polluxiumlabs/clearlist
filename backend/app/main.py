from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.verify import router as verification_router
from app.config import settings

app = FastAPI(
    title="Clearlist Verification API",
    version="1.0.0",
    description="A stateless, in-memory email verification service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)
app.include_router(verification_router)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"status": "ok", "storage": False}
