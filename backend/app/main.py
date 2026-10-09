"""FastAPI application entry point.

Module routers are not mounted yet; they are added as each module's
controllers are implemented against the approved T03 contract.
"""

from fastapi import FastAPI

app = FastAPI(title="Claimwise API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
