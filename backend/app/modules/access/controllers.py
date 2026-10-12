"""Access FastAPI router, auth dependencies and endpoints (mounted under /api/v1).

Callers send the Keycloak access token: `Authorization: Bearer <token>`.
Other modules protect endpoints with BOTH checks:
    principal = Depends(require_permission("claims:approve"))   # permission
    await services.ensure_in_scope(session, principal, claim)    # scope (404 if out of scope)
"""

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import forbidden, not_authenticated
from app.core.security import decode_access_token
from app.modules.access import dtos, services
from app.modules.access.services import Principal

Session = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_principal(
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Principal:
    """401 unless the bearer token is a valid Keycloak access token for this API.

    Roles come from the token; their permissions and the caller's organization
    status come from the DB on every request.
    """
    if credentials is None:
        raise not_authenticated()
    try:
        claims = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise not_authenticated() from None
    return await services.build_principal(session, claims)


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]


def require_permission(permission: str) -> Callable[..., Awaitable[Principal]]:
    """Dependency: authenticated principal holding `permission`, else 401/403."""

    async def dependency(principal: CurrentPrincipal) -> Principal:
        if not principal.has(permission):
            raise forbidden()
        return principal

    return dependency


TenantsManager = Annotated[Principal, Depends(require_permission("tenants:manage"))]
UsersManager = Annotated[Principal, Depends(require_permission("users:manage"))]
RolesManager = Annotated[Principal, Depends(require_permission("roles:manage"))]

# TODO(T03): align pagination parameters with the API contract.
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]

router = APIRouter()


def _page(items: list, total: int, limit: int, offset: int) -> dict:
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# --- Auth ---------------------------------------------------------------


@router.get("/auth/me", response_model=dtos.MeOut, tags=["auth"])
async def me(principal: CurrentPrincipal, session: Session) -> dtos.MeOut:
    return await services.get_me(session, principal)


# --- Tenants (organizations) ----------------------------------------------


@router.post("/admin/tenants", response_model=dtos.TenantOut, status_code=201, tags=["admin"])
async def create_tenant(body: dtos.TenantCreate, actor: TenantsManager, session: Session):
    return await services.create_tenant(session, actor, body)


@router.get("/admin/tenants", response_model=dtos.Page[dtos.TenantOut], tags=["admin"])
async def list_tenants(
    _: TenantsManager, session: Session, limit: Limit = 50, offset: Offset = 0, type: dtos.TenantType | None = None
):
    items, total = await services.list_tenants(session, limit, offset, type)
    return _page(items, total, limit, offset)


@router.get("/admin/tenants/{tenant_id}", response_model=dtos.TenantOut, tags=["admin"])
async def get_tenant(tenant_id: uuid.UUID, _: TenantsManager, session: Session):
    return await services.get_tenant(session, tenant_id)


@router.patch("/admin/tenants/{tenant_id}", response_model=dtos.TenantOut, tags=["admin"])
async def update_tenant(tenant_id: uuid.UUID, body: dtos.TenantUpdate, actor: TenantsManager, session: Session):
    return await services.update_tenant(session, actor, tenant_id, body)


# --- TPA delegations ------------------------------------------------------


@router.post("/admin/tpa-delegations", response_model=dtos.TpaDelegationOut, status_code=201, tags=["admin"])
async def create_delegation(body: dtos.TpaDelegationCreate, actor: TenantsManager, session: Session):
    return await services.create_delegation(session, actor, body)


@router.get("/admin/tpa-delegations", response_model=dtos.Page[dtos.TpaDelegationOut], tags=["admin"])
async def list_delegations(
    _: TenantsManager,
    session: Session,
    limit: Limit = 50,
    offset: Offset = 0,
    tpa_tenant_id: uuid.UUID | None = None,
    insurer_tenant_id: uuid.UUID | None = None,
):
    items, total = await services.list_delegations(session, limit, offset, tpa_tenant_id, insurer_tenant_id)
    return _page(items, total, limit, offset)


@router.patch("/admin/tpa-delegations/{delegation_id}", response_model=dtos.TpaDelegationOut, tags=["admin"])
async def end_delegation(
    delegation_id: uuid.UUID, body: dtos.TpaDelegationEnd, actor: TenantsManager, session: Session
):
    return await services.end_delegation(session, actor, delegation_id, body)


# --- Roles and permissions ------------------------------------------------


@router.get("/admin/roles", response_model=dtos.Page[dtos.RoleOut], tags=["admin"])
async def list_roles(_: RolesManager, session: Session, limit: Limit = 50, offset: Offset = 0):
    items, total = await services.list_roles(session, limit, offset)
    return _page(items, total, limit, offset)


@router.get("/admin/permissions", response_model=dtos.Page[dtos.PermissionOut], tags=["admin"])
async def list_permissions(_: RolesManager, session: Session, limit: Limit = 50, offset: Offset = 0):
    items, total = await services.list_permissions(session, limit, offset)
    return _page(items, total, limit, offset)


@router.post("/admin/roles/{role_id}/permissions", response_model=dtos.RoleOut, status_code=201, tags=["admin"])
async def grant_permission(
    role_id: uuid.UUID, body: dtos.RolePermissionGrant, actor: RolesManager, session: Session
):
    return await services.grant_permission(session, actor, role_id, body.permission_id)


@router.delete("/admin/roles/{role_id}/permissions/{permission_id}", status_code=204, tags=["admin"])
async def revoke_permission(role_id: uuid.UUID, permission_id: uuid.UUID, actor: RolesManager, session: Session):
    await services.revoke_permission(session, actor, role_id, permission_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Patient member links -------------------------------------------------


@router.post(
    "/admin/patient-member-links", response_model=dtos.PatientMemberLinkOut, status_code=201, tags=["admin"]
)
async def create_patient_link(body: dtos.PatientMemberLinkCreate, actor: UsersManager, session: Session):
    return await services.create_patient_link(session, actor, body)


@router.get("/admin/patient-member-links", response_model=dtos.Page[dtos.PatientMemberLinkOut], tags=["admin"])
async def list_patient_links(
    _: UsersManager, session: Session, limit: Limit = 50, offset: Offset = 0, user_id: uuid.UUID | None = None
):
    items, total = await services.list_patient_links(session, limit, offset, user_id)
    return _page(items, total, limit, offset)


@router.delete("/admin/patient-member-links/{link_id}", status_code=204, tags=["admin"])
async def delete_patient_link(link_id: uuid.UUID, actor: UsersManager, session: Session):
    await services.delete_patient_link(session, actor, link_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
