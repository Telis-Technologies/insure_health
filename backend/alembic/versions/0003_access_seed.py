"""Seed roles, permissions and role grants (T06; D04 answered by Obunde 2026-10-12).

Roles mirror the Keycloak realm roles in infra/keycloak/claimwise-realm.json
(Lameck's 10 roles plus `patient`). Codes must match `realm_access.roles`.

OPEN (D04): tpa-reviewer payments:read and reports:read are NOT granted until
decided. history:read and consent:manage exist but are granted to nobody
(D07 deferred; T17 adds the consent check). platform-admin holds
administration permissions only.

Revision ID: 0003_access_seed
Revises: 0002_access
Create Date: 2026-10-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_access_seed"
down_revision: Union[str, Sequence[str], None] = "0002_access"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# code, name, allowed organization type (None = user without an organization)
ROLES = [
    ("platform-admin", "Platform administrator", None),
    ("tenant-admin", "Organization administrator", "insurer"),
    ("provider-biller", "Provider billing", "hospital"),
    ("tpa-reviewer", "TPA reviewer", "tpa"),
    ("insurer-claims-adjudicator", "Claims adjudicator", "insurer"),
    ("insurer-claims-approver", "Claims approver", "insurer"),
    ("insurer-finance", "Insurer finance", "insurer"),
    ("insurer-policy-author", "Policy author", "insurer"),
    ("insurer-policy-approver", "Policy approver", "insurer"),
    ("auditor", "Auditor", "insurer"),
    ("patient", "Patient", None),
]

PERMISSIONS = {
    "tenants:manage": "Create, update and disable organizations and TPA delegations.",
    "users:manage": "Link patient users to members.",
    "roles:manage": "Change the permissions granted to roles.",
    "claims:read": "Read claims in scope.",
    "claims:create": "Create claim drafts.",
    "claims:submit": "Submit claims.",
    "claims:correct": "Respond to correction requests on submitted claims.",
    "claims:review": "Review and assess claims.",
    "corrections:request": "Request corrections from the provider.",
    "claims:approve": "Approve claims.",
    "coverage:read": "Read policies and coverage in scope.",
    "contracts:read": "Read provider contracts and tariffs in scope.",
    "policies:draft": "Draft policy and rule versions.",
    "policies:publish": "Approve and publish policy and rule versions (independent of the author).",
    "payments:record": "Record payments.",
    "reconciliation:perform": "Reconcile payments.",
    "payments:read": "Read payments in scope.",
    "reports:read": "Read reports.",
    "audit:read": "Read audit records in scope.",
    "consent:manage": "Grant and withdraw consent for health history access.",
    "history:read": "Read health history in scope; also requires a consent check (T17).",
}

GRANTS = {
    "platform-admin": ["tenants:manage", "roles:manage", "users:manage"],
    "tenant-admin": ["audit:read"],
    "provider-biller": [
        "claims:read",
        "claims:create",
        "claims:submit",
        "claims:correct",
        "coverage:read",
        "contracts:read",
        "payments:read",
    ],
    "tpa-reviewer": ["claims:read", "claims:review", "corrections:request", "coverage:read", "contracts:read"],
    "insurer-claims-adjudicator": [
        "claims:read",
        "claims:review",
        "corrections:request",
        "coverage:read",
        "contracts:read",
    ],
    "insurer-claims-approver": ["claims:read", "claims:approve", "coverage:read", "contracts:read"],
    "insurer-finance": ["claims:read", "payments:read", "payments:record", "reconciliation:perform", "reports:read"],
    "insurer-policy-author": ["coverage:read", "contracts:read", "policies:draft"],
    "insurer-policy-approver": ["coverage:read", "contracts:read", "policies:publish"],
    "auditor": ["audit:read"],
    "patient": ["claims:read", "coverage:read", "payments:read"],
}

roles = sa.table(
    "roles",
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("allowed_tenant_type", sa.String),
    sa.column("is_system", sa.Boolean),
)
permissions = sa.table("permissions", sa.column("code", sa.String), sa.column("description", sa.Text))


def upgrade() -> None:
    op.bulk_insert(
        roles,
        [{"code": c, "name": n, "allowed_tenant_type": t, "is_system": True} for c, n, t in ROLES],
    )
    op.bulk_insert(permissions, [{"code": c, "description": d} for c, d in PERMISSIONS.items()])

    conn = op.get_bind()
    insert = sa.text(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = :role AND p.code = :permission"
    )
    for role, codes in GRANTS.items():
        for code in codes:
            conn.execute(insert, {"role": role, "permission": code})


def downgrade() -> None:
    conn = op.get_bind()
    # role_permissions rows cascade from roles/permissions.
    conn.execute(sa.text("DELETE FROM roles WHERE code = ANY(:codes)"), {"codes": [c for c, _, _ in ROLES]})
    conn.execute(sa.text("DELETE FROM permissions WHERE code = ANY(:codes)"), {"codes": list(PERMISSIONS)})
