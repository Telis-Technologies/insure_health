"""Access Pydantic request/response DTOs."""

import uuid
from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

TenantType = Literal["insurer", "hospital", "tpa"]
Status = Literal["active", "disabled"]
UserType = Literal["platform_admin", "tenant_user", "patient"]

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# Keycloak organization id, e.g. "PRO-HHA-01" or "harbor-health-assurance".
ExternalId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$", max_length=100)]

T = TypeVar("T")


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    # TODO(T03): align pagination shape with the API contract.
    items: list[T]
    total: int
    limit: int
    offset: int


# --- Tenants (organizations) ----------------------------------------------


class TenantCreate(BaseModel):
    external_id: ExternalId
    name: Name
    type: TenantType


class TenantUpdate(BaseModel):
    name: Name | None = None
    status: Status | None = None


class TenantOut(_Out):
    id: uuid.UUID
    external_id: str
    name: str
    type: TenantType
    status: Status
    created_at: datetime
    updated_at: datetime


# --- Me -----------------------------------------------------------------


class MeOut(BaseModel):
    user_id: uuid.UUID
    username: str | None
    email: str | None
    user_type: UserType
    organization: TenantOut | None
    roles: list[str]
    permissions: list[str]


# --- Roles and permissions ------------------------------------------------


class PermissionOut(_Out):
    id: uuid.UUID
    code: str
    description: str


class RoleOut(_Out):
    id: uuid.UUID
    code: str
    name: str
    allowed_tenant_type: TenantType | None
    is_system: bool
    created_at: datetime
    permissions: list[str] = []


class RolePermissionGrant(BaseModel):
    permission_id: uuid.UUID


# --- TPA delegations ------------------------------------------------------


class TpaDelegationCreate(BaseModel):
    tpa_tenant_id: uuid.UUID
    insurer_tenant_id: uuid.UUID
    valid_from: datetime | None = Field(default=None, description="Defaults to now.")
    valid_to: datetime | None = None


class TpaDelegationEnd(BaseModel):
    valid_to: datetime | None = Field(default=None, description="Defaults to now.")


class TpaDelegationOut(_Out):
    id: uuid.UUID
    tpa_tenant_id: uuid.UUID
    insurer_tenant_id: uuid.UUID
    valid_from: datetime
    valid_to: datetime | None
    created_by: uuid.UUID
    created_at: datetime


# --- Patient member links -------------------------------------------------


class PatientMemberLinkCreate(BaseModel):
    user_id: uuid.UUID = Field(description="Keycloak user id of a user holding the patient role.")
    member_id: uuid.UUID


class PatientMemberLinkOut(_Out):
    id: uuid.UUID
    user_id: uuid.UUID
    member_id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
