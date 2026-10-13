"""Permission checks for Lameck's roles; platform-admin has no data access."""

import pytest
from sqlalchemy import select

from app.modules.access.models import Permission, Role, RolePermission
from app.modules.access.services import ADMIN_PERMISSIONS

pytestmark = pytest.mark.anyio

ADMIN_ENDPOINTS = [
    "/api/v1/admin/tenants",
    "/api/v1/admin/tpa-delegations",
    "/api/v1/admin/roles",
    "/api/v1/admin/permissions",
    "/api/v1/admin/patient-member-links",
]


async def _role_permissions(session, code: str) -> set[str]:
    rows = await session.scalars(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .where(Role.code == code)
    )
    return set(rows)


async def test_provider_biller_cannot_approve_claims(client, factory):
    hospital = await factory.tenant("hospital")

    response = await client.post("/probe/claims-approve", headers=factory.auth(["provider-biller"], hospital))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_tpa_reviewer_cannot_approve_record_payments_or_read_reports(client, factory):
    tpa = factory.auth(["tpa-reviewer"], await factory.tenant("tpa"))

    assert (await client.post("/probe/claims-approve", headers=tpa)).status_code == 403
    assert (await client.post("/probe/payments-record", headers=tpa)).status_code == 403
    assert (await client.get("/probe/reports", headers=tpa)).status_code == 403
    assert (await client.get("/probe/claims-read", headers=tpa)).status_code == 200


async def test_adjudicator_reviews_but_only_approver_approves(client, factory):
    insurer = await factory.tenant("insurer")

    adjudicator = factory.auth(["insurer-claims-adjudicator"], insurer)
    approver = factory.auth(["insurer-claims-approver"], insurer)

    assert (await client.post("/probe/claims-approve", headers=adjudicator)).status_code == 403
    assert (await client.post("/probe/claims-approve", headers=approver)).status_code == 200


async def test_only_finance_records_payments(client, factory):
    insurer = await factory.tenant("insurer")

    assert (await client.post("/probe/payments-record", headers=factory.auth(["insurer-finance"], insurer))).status_code == 200
    for role in ["insurer-claims-approver", "insurer-claims-adjudicator", "tenant-admin", "auditor"]:
        response = await client.post("/probe/payments-record", headers=factory.auth([role], insurer))
        assert response.status_code == 403, role


async def test_seeded_grants_match_the_approved_table(session):
    expected = {
        "platform-admin": {"tenants:manage", "roles:manage", "users:manage"},
        "tenant-admin": {"audit:read"},
        "provider-biller": {
            "claims:read", "claims:create", "claims:submit", "claims:correct",
            "coverage:read", "contracts:read", "payments:read",
        },
        "tpa-reviewer": {"claims:read", "claims:review", "corrections:request", "coverage:read", "contracts:read"},
        "insurer-claims-adjudicator": {
            "claims:read", "claims:review", "corrections:request", "coverage:read", "contracts:read",
        },
        "insurer-claims-approver": {"claims:read", "claims:approve", "coverage:read", "contracts:read"},
        "insurer-finance": {"claims:read", "payments:read", "payments:record", "reconciliation:perform", "reports:read"},
        "insurer-policy-author": {"coverage:read", "contracts:read", "policies:draft"},
        "insurer-policy-approver": {"coverage:read", "contracts:read", "policies:publish"},
        "auditor": {"audit:read"},
        "patient": {"claims:read", "coverage:read", "payments:read"},
    }
    for role, permissions in expected.items():
        assert await _role_permissions(session, role) == permissions, role

    granted = set(await session.scalars(select(Permission.code).join(RolePermission)))
    assert "history:read" not in granted and "consent:manage" not in granted


async def test_platform_admin_has_only_admin_permissions(client, factory):
    admin = factory.platform_admin()

    whoami = await client.get("/probe/whoami", headers=admin)
    assert set(whoami.json()["permissions"]) == ADMIN_PERMISSIONS
    assert (await client.get("/probe/claims-read", headers=admin)).status_code == 403
    for url in ADMIN_ENDPOINTS:
        assert (await client.get(url, headers=admin)).status_code == 200, url


async def test_non_admins_get_403_on_admin_endpoints(client, factory):
    insurer = await factory.tenant("insurer")
    callers = [factory.auth([role], insurer) for role in ("tenant-admin", "auditor", "insurer-finance")]
    callers.append(factory.auth(["provider-biller"], await factory.tenant("hospital")))
    callers.append(factory.auth(["tpa-reviewer"], await factory.tenant("tpa")))
    callers.append(factory.auth(["patient"]))

    for headers in callers:
        for url in ADMIN_ENDPOINTS:
            assert (await client.get(url, headers=headers)).status_code == 403, url
        create = await client.post(
            "/api/v1/admin/tenants", json={"external_id": "x", "name": "X", "type": "insurer"}, headers=headers
        )
        assert create.status_code == 403


async def test_unauthenticated_admin_call_is_401(client):
    assert (await client.get("/api/v1/admin/tenants")).status_code == 401
