"""Access test fixtures: real Postgres test database, per-test rollback, Keycloak-shaped tokens.

The test database is <POSTGRES_DB>_test on the same server, created on first
run and migrated to head with Alembic (so the seed migration is exercised).
Each test runs inside an outer transaction that is rolled back afterwards.

Tokens are signed with a throwaway RSA key and shaped like Keycloak access
tokens for the claimwise realm (iss, aud=claimwise-api, realm_access.roles,
organization_ids). The JWKS lookup is patched to return the test public key.
"""

import asyncio
import os
import subprocess
import sys
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import APIRouter, Depends, FastAPI
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import security
from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import register_error_handlers
from app.modules.access.controllers import CurrentPrincipal, require_permission
from app.modules.access.controllers import router as access_router
from app.modules.access.models import Role, Tenant
from app.modules.access.services import Principal, build_principal

_base_url = make_url(os.environ["DATABASE_URL"])
TEST_DATABASE_URL = _base_url.set(database=f"{_base_url.database}_test").render_as_string(hide_password=False)

SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


async def _create_test_database() -> None:
    engine = create_async_engine(_base_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
    name = make_url(TEST_DATABASE_URL).database
    async with engine.connect() as conn:
        exists = await conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name})
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{name}"'))
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    asyncio.run(_create_test_database())
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        check=True,
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        capture_output=True,
    )


@pytest.fixture(autouse=True)
def _test_signing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "signing_key_for", lambda token: SIGNING_KEY.public_key())


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.connect() as conn:
        outer = await conn.begin()
        db = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            yield db
        finally:
            await db.close()
            await outer.rollback()
    await engine.dispose()


def _build_app() -> FastAPI:
    # Test-only endpoints standing in for future module endpoints (no claims tables).
    probe = APIRouter(prefix="/probe")

    @probe.get("/claims-read")
    async def claims_read(_: Principal = Depends(require_permission("claims:read"))) -> dict:
        return {"ok": True}

    @probe.post("/claims-approve")
    async def claims_approve(_: Principal = Depends(require_permission("claims:approve"))) -> dict:
        return {"ok": True}

    @probe.post("/payments-record")
    async def payments_record(_: Principal = Depends(require_permission("payments:record"))) -> dict:
        return {"ok": True}

    @probe.get("/reports")
    async def reports(_: Principal = Depends(require_permission("reports:read"))) -> dict:
        return {"ok": True}

    @probe.get("/whoami")
    async def whoami(principal: CurrentPrincipal) -> dict:
        return {"permissions": sorted(principal.permissions), "roles": sorted(principal.roles)}

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(access_router, prefix="/api/v1")
    app.include_router(probe)
    return app


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    app = _build_app()

    async def _session_override() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _session_override
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as http:
        yield http


# --- Factories ----------------------------------------------------------


class Factory:
    other_key = OTHER_KEY  # a key the API does not trust

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def tenant(self, type_: str, *, status: str = "active") -> Tenant:
        suffix = uuid.uuid4().hex[:6]
        tenant = Tenant(
            external_id=f"{type_}-{suffix}", name=f"Synthetic {type_} {suffix}", type=type_, status=status
        )
        self.session.add(tenant)
        await self.session.flush()
        return tenant

    @staticmethod
    def claims(
        roles: list[str],
        organization: Tenant | str | list[str] | None = None,
        *,
        sub: uuid.UUID | str | None = None,
        **overrides: Any,
    ) -> dict[str, Any]:
        """Claims shaped like a Keycloak access token for the claimwise realm."""
        now = datetime.now(UTC)
        if isinstance(organization, Tenant):
            organization_ids = [organization.external_id]
        elif isinstance(organization, str):
            organization_ids = [organization]
        else:
            organization_ids = organization or []
        claims: dict[str, Any] = {
            "iss": get_settings().keycloak_issuer,
            "aud": [get_settings().keycloak_audience, "account"],
            "azp": "claimwise-web",
            "sub": str(sub or uuid.uuid4()),
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "preferred_username": "synthetic.user",
            "email": "synthetic.user@example.test",
            "realm_access": {"roles": [*roles, "default-roles-claimwise", "offline_access"]},
            "tenant_ids": ["harbor-health-assurance"],
            "organization_ids": organization_ids,
        }
        claims.update(overrides)
        return claims

    @staticmethod
    def token(claims: dict[str, Any], key: Any = SIGNING_KEY, algorithm: str = "RS256") -> str:
        return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": "test-key"})

    def auth(self, roles: list[str], organization: Tenant | str | list[str] | None = None, **kwargs: Any) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token(self.claims(roles, organization, **kwargs))}"}

    def platform_admin(self) -> dict[str, str]:
        return self.auth(["platform-admin"])

    async def principal(self, roles: list[str], organization: Tenant | None = None, **kwargs: Any) -> Principal:
        return await build_principal(self.session, self.claims(roles, organization, **kwargs))

    async def role_id(self, code: str) -> uuid.UUID:
        return await self.session.scalar(select(Role.id).where(Role.code == code))


@pytest.fixture
def factory(session: AsyncSession) -> Factory:
    return Factory(session)
