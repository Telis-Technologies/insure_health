"""Access SQLAlchemy ORM models: organizations (tenants), RBAC, TPA delegations, patient links.

Users live in Keycloak (D04): user ids here are Keycloak user ids (token `sub`),
stored as plain UUIDs without FKs. Enum-like columns are VARCHAR + CHECK
constraints so values can be added by migration without ALTER TYPE.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base import Base

TENANT_TYPES = ("insurer", "hospital", "tpa")
STATUSES = ("active", "disabled")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Tenant(Base):
    """An insurer, hospital or TPA organization. `external_id` = Keycloak `organization_ids` entry."""

    __tablename__ = "tenants"
    __table_args__ = (
        CheckConstraint(_in("type", TENANT_TYPES), name="type"),
        CheckConstraint(_in("status", STATUSES), name="status"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    external_id: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default="active")
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Role(Base):
    """Mirrors a Keycloak realm role. Codes must match `realm_access.roles` in the token."""

    __tablename__ = "roles"
    __table_args__ = (
        CheckConstraint(
            f"allowed_tenant_type IS NULL OR {_in('allowed_tenant_type', TENANT_TYPES)}",
            name="allowed_tenant_type",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    # Organization type the role applies to; NULL for roles without an organization
    # (platform-admin, patient).
    allowed_tenant_type: Mapped[str | None] = mapped_column(String(20))
    is_system: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = _created_at()


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (CheckConstraint("code ~ '^[a-z_]+:[a-z_]+$'", name="code_format"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class TpaDelegation(Base):
    __tablename__ = "tpa_delegations"
    __table_args__ = (
        CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="valid_period"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    tpa_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), index=True
    )
    insurer_tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), index=True
    )
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # Keycloak user id
    created_at: Mapped[datetime] = _created_at()


class PatientMemberLink(Base):
    __tablename__ = "patient_member_links"
    __table_args__ = (UniqueConstraint("user_id", "member_id"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)  # Keycloak user id
    # TODO(T07, Tristan/Brian): add FK to the coverage module's members table once it exists.
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # Keycloak user id
    created_at: Mapped[datetime] = _created_at()
