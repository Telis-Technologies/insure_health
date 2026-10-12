"""Access business logic: principal from a Keycloak token, admin operations, scope checks.

Identity and role assignment live in Keycloak (D04, 2026-10-12). The backend
maps the token's realm roles to permissions stored here, and owns organizations,
TPA delegations and patient-member links. Every admin change writes an
audit_events row in the same transaction. Code checks permission codes, never
role names.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol, TypeVar

from sqlalchemy import ColumnElement, Select, false, func, literal, or_, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, conflict, invalid, not_authenticated, not_found
from app.modules.access import dtos
from app.modules.access.models import (
    PatientMemberLink,
    Permission,
    Role,
    RolePermission,
    Tenant,
    TpaDelegation,
)
from app.modules.audit.models import AuditEvent

PLATFORM_ADMIN_ROLE = "platform-admin"
PATIENT_ROLE = "patient"
# Permissions only platform-admin may hold; platform-admin holds nothing else
# (it manages the platform and has no data access).
ADMIN_PERMISSIONS = frozenset({"tenants:manage", "users:manage", "roles:manage"})

T = TypeVar("T")


@dataclass(frozen=True)
class Principal:
    """The authenticated caller: identity from the token, permissions freshly loaded from the DB."""

    user_id: uuid.UUID
    user_type: str
    tenant_id: uuid.UUID | None
    tenant_type: str | None
    roles: frozenset[str]
    permissions: frozenset[str]
    username: str | None = None
    email: str | None = None

    def has(self, permission: str) -> bool:
        return permission in self.permissions


# --- Audit --------------------------------------------------------------


def record_audit(
    session: AsyncSession,
    actor: Principal | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | str | None,
    metadata: dict[str, Any] | None = None,
    *,
    reason: str | None = None,
) -> None:
    """Add an audit row to the current transaction. Never pass tokens or clinical content."""
    session.add(
        AuditEvent(
            actor_user_id=actor.user_id if actor else None,
            actor_tenant_id=actor.tenant_id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            reason=reason,
            metadata_=metadata or {},
        )
    )


# --- Principal from verified token claims ---------------------------------


def _str_list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)]
    return []


def _organization_not_registered() -> AppError:
    return AppError(
        403, "organization_not_registered", "Your organization is not registered for this service."
    )


async def build_principal(session: AsyncSession, claims: dict[str, Any]) -> Principal:
    """Turn verified Keycloak claims into a Principal.

    - platform-admin: no organization; only the platform-admin role counts.
    - patient: no organization; only the patient role counts.
    - everyone else: exactly one `organization_ids` entry registered as an active
      tenant; roles whose allowed_tenant_type differs from the org type are ignored.
    Token `tenant_ids` is not used for scope; TPA scope comes from tpa_delegations.
    """
    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError, TypeError):
        raise not_authenticated() from None

    token_roles = set(_str_list((claims.get("realm_access") or {}).get("roles")))
    known = {
        code: tenant_type
        for code, tenant_type in await session.execute(
            select(Role.code, Role.allowed_tenant_type).where(Role.code.in_(token_roles))
        )
    }

    tenant: Tenant | None = None
    if PLATFORM_ADMIN_ROLE in known:
        user_type, effective = "platform_admin", {PLATFORM_ADMIN_ROLE}
    elif PATIENT_ROLE in known:
        user_type, effective = "patient", {PATIENT_ROLE}
    else:
        user_type = "tenant_user"
        organizations = _str_list(claims.get("organization_ids"))
        if len(organizations) != 1:
            raise _organization_not_registered()
        tenant = await session.scalar(select(Tenant).where(Tenant.external_id == organizations[0]))
        if tenant is None:
            raise _organization_not_registered()
        if tenant.status != "active":
            raise not_authenticated()
        effective = {code for code, tenant_type in known.items() if tenant_type == tenant.type}

    permissions = (
        await session.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .where(Role.code.in_(effective))
            .distinct()
        )
    ).all() if effective else []

    return Principal(
        user_id=user_id,
        user_type=user_type,
        tenant_id=tenant.id if tenant else None,
        tenant_type=tenant.type if tenant else None,
        roles=frozenset(effective),
        permissions=frozenset(permissions),
        username=claims.get("preferred_username"),
        email=claims.get("email"),
    )


async def get_me(session: AsyncSession, principal: Principal) -> dtos.MeOut:
    tenant = await session.get(Tenant, principal.tenant_id) if principal.tenant_id else None
    return dtos.MeOut(
        user_id=principal.user_id,
        username=principal.username,
        email=principal.email,
        user_type=principal.user_type,
        organization=dtos.TenantOut.model_validate(tenant) if tenant else None,
        roles=sorted(principal.roles),
        permissions=sorted(principal.permissions),
    )


# --- Helpers ------------------------------------------------------------


async def _page(session: AsyncSession, stmt: Select, limit: int, offset: int) -> tuple[Sequence[Any], int]:
    total = await session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = (await session.scalars(stmt.limit(limit).offset(offset))).all()
    return items, total or 0


async def _get_or_404(session: AsyncSession, model: type[T], entity_id: uuid.UUID, label: str) -> T:
    obj = await session.get(model, entity_id)
    if obj is None:
        raise not_found(label)
    return obj


def _apply(obj: Any, values: dict[str, Any]) -> dict[str, Any]:
    changes = {k: v for k, v in values.items() if getattr(obj, k) != v}
    for key, value in changes.items():
        setattr(obj, key, value)
    return changes


# --- Tenants (organizations) ----------------------------------------------


async def create_tenant(session: AsyncSession, actor: Principal, data: dtos.TenantCreate) -> Tenant:
    if await session.scalar(select(Tenant.id).where(Tenant.external_id == data.external_id)):
        raise conflict("An organization with this external_id already exists.")
    tenant = Tenant(external_id=data.external_id, name=data.name, type=data.type, status="active")
    session.add(tenant)
    await session.flush()
    record_audit(
        session,
        actor,
        "tenant.created",
        "tenant",
        tenant.id,
        {"external_id": data.external_id, "name": data.name, "type": data.type},
    )
    await session.commit()
    await session.refresh(tenant)
    return tenant


async def list_tenants(
    session: AsyncSession, limit: int, offset: int, type_: str | None = None
) -> tuple[Sequence[Tenant], int]:
    stmt = select(Tenant).order_by(Tenant.created_at, Tenant.id)
    if type_:
        stmt = stmt.where(Tenant.type == type_)
    return await _page(session, stmt, limit, offset)


async def get_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    return await _get_or_404(session, Tenant, tenant_id, "Tenant")


async def update_tenant(
    session: AsyncSession, actor: Principal, tenant_id: uuid.UUID, data: dtos.TenantUpdate
) -> Tenant:
    tenant = await get_tenant(session, tenant_id)
    changes = _apply(tenant, data.model_dump(exclude_unset=True, exclude_none=True))
    if changes:
        action = "tenant.disabled" if changes.get("status") == "disabled" else "tenant.updated"
        record_audit(session, actor, action, "tenant", tenant.id, {"changes": changes})
        await session.commit()
        await session.refresh(tenant)
    return tenant


# --- Roles and permissions ------------------------------------------------


async def _permissions_by_role(
    session: AsyncSession, role_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    ids = list(role_ids)
    result: dict[uuid.UUID, list[str]] = {rid: [] for rid in ids}
    if ids:
        rows = await session.execute(
            select(RolePermission.role_id, Permission.code)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(RolePermission.role_id.in_(ids))
            .order_by(Permission.code)
        )
        for role_id, code in rows:
            result[role_id].append(code)
    return result


async def roles_out(session: AsyncSession, roles: Sequence[Role]) -> list[dtos.RoleOut]:
    perms = await _permissions_by_role(session, (r.id for r in roles))
    return [dtos.RoleOut.model_validate(r).model_copy(update={"permissions": perms[r.id]}) for r in roles]


async def list_roles(session: AsyncSession, limit: int, offset: int) -> tuple[list[dtos.RoleOut], int]:
    roles, total = await _page(session, select(Role).order_by(Role.code), limit, offset)
    return await roles_out(session, roles), total


async def list_permissions(
    session: AsyncSession, limit: int, offset: int
) -> tuple[Sequence[Permission], int]:
    return await _page(session, select(Permission).order_by(Permission.code), limit, offset)


async def grant_permission(
    session: AsyncSession, actor: Principal, role_id: uuid.UUID, permission_id: uuid.UUID
) -> dtos.RoleOut:
    role = await _get_or_404(session, Role, role_id, "Role")
    permission = await _get_or_404(session, Permission, permission_id, "Permission")
    if (role.code == PLATFORM_ADMIN_ROLE) != (permission.code in ADMIN_PERMISSIONS):
        raise invalid(
            "Platform administration permissions are reserved for the platform-admin role, "
            "which holds no data permissions."
        )
    if await session.get(RolePermission, (role.id, permission.id)):
        raise conflict("Permission is already granted to this role.")

    session.add(RolePermission(role_id=role.id, permission_id=permission.id))
    record_audit(
        session,
        actor,
        "role.permission_granted",
        "role",
        role.id,
        {"role": role.code, "permission": permission.code},
    )
    await session.commit()
    return (await roles_out(session, [role]))[0]


async def revoke_permission(
    session: AsyncSession, actor: Principal, role_id: uuid.UUID, permission_id: uuid.UUID
) -> None:
    link = await session.get(RolePermission, (role_id, permission_id))
    if link is None:
        raise not_found("Role permission")
    role = await session.get(Role, role_id)
    permission = await session.get(Permission, permission_id)
    await session.delete(link)
    record_audit(
        session,
        actor,
        "role.permission_revoked",
        "role",
        role_id,
        {"role": role.code, "permission": permission.code},
    )
    await session.commit()


# --- TPA delegations ------------------------------------------------------


async def create_delegation(
    session: AsyncSession, actor: Principal, data: dtos.TpaDelegationCreate
) -> TpaDelegation:
    tpa = await _get_or_404(session, Tenant, data.tpa_tenant_id, "TPA tenant")
    insurer = await _get_or_404(session, Tenant, data.insurer_tenant_id, "Insurer tenant")
    if tpa.type != "tpa":
        raise invalid("tpa_tenant_id must be a tenant of type tpa.")
    if insurer.type != "insurer":
        raise invalid("insurer_tenant_id must be a tenant of type insurer.")
    valid_from = data.valid_from or datetime.now(UTC)
    if data.valid_to is not None and data.valid_to <= valid_from:
        raise invalid("valid_to must be after valid_from.")

    delegation = TpaDelegation(
        tpa_tenant_id=tpa.id,
        insurer_tenant_id=insurer.id,
        valid_from=valid_from,
        valid_to=data.valid_to,
        created_by=actor.user_id,
    )
    session.add(delegation)
    await session.flush()
    record_audit(
        session,
        actor,
        "tpa_delegation.created",
        "tpa_delegation",
        delegation.id,
        {
            "tpa_tenant_id": str(tpa.id),
            "insurer_tenant_id": str(insurer.id),
            "valid_from": valid_from.isoformat(),
            "valid_to": data.valid_to.isoformat() if data.valid_to else None,
        },
    )
    await session.commit()
    await session.refresh(delegation)
    return delegation


async def list_delegations(
    session: AsyncSession,
    limit: int,
    offset: int,
    tpa_tenant_id: uuid.UUID | None = None,
    insurer_tenant_id: uuid.UUID | None = None,
) -> tuple[Sequence[TpaDelegation], int]:
    stmt = select(TpaDelegation).order_by(TpaDelegation.created_at, TpaDelegation.id)
    if tpa_tenant_id:
        stmt = stmt.where(TpaDelegation.tpa_tenant_id == tpa_tenant_id)
    if insurer_tenant_id:
        stmt = stmt.where(TpaDelegation.insurer_tenant_id == insurer_tenant_id)
    return await _page(session, stmt, limit, offset)


async def end_delegation(
    session: AsyncSession, actor: Principal, delegation_id: uuid.UUID, data: dtos.TpaDelegationEnd
) -> TpaDelegation:
    delegation = await _get_or_404(session, TpaDelegation, delegation_id, "TPA delegation")
    now = datetime.now(UTC)
    if delegation.valid_to is not None and delegation.valid_to <= now:
        raise conflict("Delegation has already ended.")
    valid_to = data.valid_to or now
    if valid_to <= delegation.valid_from:
        raise invalid("valid_to must be after valid_from.")

    delegation.valid_to = valid_to
    record_audit(
        session,
        actor,
        "tpa_delegation.ended",
        "tpa_delegation",
        delegation.id,
        {"valid_to": valid_to.isoformat()},
    )
    await session.commit()
    await session.refresh(delegation)
    return delegation


# --- Patient member links -------------------------------------------------


async def create_patient_link(
    session: AsyncSession, actor: Principal, data: dtos.PatientMemberLinkCreate
) -> PatientMemberLink:
    # The backend cannot see Keycloak role assignments for other users; the link only
    # grants scope when the caller's own token carries the patient role.
    existing = await session.scalar(
        select(PatientMemberLink.id).where(
            PatientMemberLink.user_id == data.user_id, PatientMemberLink.member_id == data.member_id
        )
    )
    if existing:
        raise conflict("This patient is already linked to this member.")

    link = PatientMemberLink(user_id=data.user_id, member_id=data.member_id, created_by=actor.user_id)
    session.add(link)
    await session.flush()
    record_audit(
        session,
        actor,
        "patient_member_link.created",
        "patient_member_link",
        link.id,
        {"user_id": str(data.user_id), "member_id": str(data.member_id)},
    )
    await session.commit()
    await session.refresh(link)
    return link


async def list_patient_links(
    session: AsyncSession, limit: int, offset: int, user_id: uuid.UUID | None = None
) -> tuple[Sequence[PatientMemberLink], int]:
    stmt = select(PatientMemberLink).order_by(PatientMemberLink.created_at, PatientMemberLink.id)
    if user_id:
        stmt = stmt.where(PatientMemberLink.user_id == user_id)
    return await _page(session, stmt, limit, offset)


async def delete_patient_link(session: AsyncSession, actor: Principal, link_id: uuid.UUID) -> None:
    link = await _get_or_404(session, PatientMemberLink, link_id, "Patient member link")
    await session.delete(link)
    record_audit(
        session,
        actor,
        "patient_member_link.deleted",
        "patient_member_link",
        link.id,
        {"user_id": str(link.user_id), "member_id": str(link.member_id)},
    )
    await session.commit()


# --- Scope checks (called by other modules) -----------------------------


class ScopedRecord(Protocol):
    """Any claim-like record: who insures it, who provided the service, which member."""

    insurer_tenant_id: uuid.UUID | None
    provider_tenant_id: uuid.UUID | None
    member_id: uuid.UUID | None


def scope_clause(
    principal: Principal,
    insurer_tenant_id: ColumnElement,
    provider_tenant_id: ColumnElement,
    member_id: ColumnElement,
) -> ColumnElement[bool]:
    """SQL filter selecting only records in the caller's scope.

    Use it in list queries: select(Claim).where(scope_clause(p, Claim.insurer_tenant_id, ...)).
    Never fetch everything and filter in Python.
    """
    if principal.user_type == "tenant_user":
        if principal.tenant_type == "hospital":
            return provider_tenant_id == principal.tenant_id
        if principal.tenant_type == "insurer":
            return insurer_tenant_id == principal.tenant_id
        if principal.tenant_type == "tpa":
            # Bound wall-clock time, not SQL now(): now() is fixed at transaction start.
            now = datetime.now(UTC)
            delegating_insurers = select(TpaDelegation.insurer_tenant_id).where(
                TpaDelegation.tpa_tenant_id == principal.tenant_id,
                TpaDelegation.valid_from <= now,
                or_(TpaDelegation.valid_to.is_(None), TpaDelegation.valid_to > now),
            )
            return insurer_tenant_id.in_(delegating_insurers)
    if principal.user_type == "patient":
        linked_members = select(PatientMemberLink.member_id).where(
            PatientMemberLink.user_id == principal.user_id
        )
        return member_id.in_(linked_members)
    # Platform admins (and anything unrecognised) are never in scope for data.
    return false()


async def is_in_scope(session: AsyncSession, principal: Principal, record: ScopedRecord) -> bool:
    """Single-record scope check, evaluated in SQL with the same rules as scope_clause."""
    clause = scope_clause(
        principal,
        literal(record.insurer_tenant_id, UUID(as_uuid=True)),
        literal(record.provider_tenant_id, UUID(as_uuid=True)),
        literal(record.member_id, UUID(as_uuid=True)),
    )
    return bool(await session.scalar(select(clause)))


async def ensure_in_scope(
    session: AsyncSession, principal: Principal, record: ScopedRecord | None, entity: str = "Resource"
) -> None:
    """Raise 404 (not 403) for missing or out-of-scope records so existence is not revealed."""
    if record is None or not await is_in_scope(session, principal, record):
        raise not_found(entity)


async def ensure_history_access(session: AsyncSession, principal: Principal, member_id: uuid.UUID) -> None:
    """history:read plus scope is never sufficient on its own: a consent check is required.

    TODO(T17, Obunde): implement the consent check (D07) here. Until then this
    refuses every request so no endpoint can release history on permission alone.
    """
    raise AppError(503, "consent_check_unavailable", "Health history access requires the consent check (T17).")
