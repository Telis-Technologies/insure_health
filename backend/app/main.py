"""FastAPI application entry point.

Module routers are mounted under /api/v1 as each module's controllers are
implemented against the approved T03 contract.
"""

from fastapi import FastAPI

from app.core.errors import register_error_handlers
from app.modules.access.controllers import router as access_router

app = FastAPI(title="Claimwise API")
register_error_handlers(app)

app.include_router(access_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
