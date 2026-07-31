from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.services.credentials import (
    CredentialStore,
    CredentialStoreUnavailable,
    get_credential_store,
)

app = FastAPI(
    title="Atelier Flow API",
    version="1.0.0",
    description="Interior project management and workflow automation platform.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.include_router(api_router, prefix="/api/v1")
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/health", tags=["System"])
def health(credentials: CredentialStore = Depends(get_credential_store)):
    try:
        credentials.ping()
    except CredentialStoreUnavailable:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "atelier-flow-api",
                "credential_store": "unavailable",
            },
        )
    return {
        "status": "healthy",
        "service": "atelier-flow-api",
        "credential_store": "mongodb",
    }


@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    if settings.app_env == "development":
        return JSONResponse(
            status_code=500, content={"error": {"code": "internal_error", "message": str(exc)}}
        )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "An unexpected error occurred"}},
    )
