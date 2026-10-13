"""Every admin change writes an audit record in the same transaction."""

import json
import uuid
from collections import Counter

import pytest
from sqlalchemy import select

from app.modules.audit.models import AuditEvent

pytestmark = pytest.mark.anyio


async def test_admin_changes_are_audited_with_keycloak_actor(client, session, factory):
    admin_sub = uuid.uuid4()
    headers = factory.auth(["platform-admin"], sub=admin_sub)

    async def call(method, url, expected, **kwargs):
        response = await client.request(method, f"/api/v1{url}", headers=headers, **kwargs)
        assert response.status_code == expected, response.text
        return response.json() if response.content else None

    insurer = await call("POST", "/admin/tenants", 201, json={"external_id": "ins-a", "name": "Synthetic Insurer", "type": "insurer"})
    tpa = await call("POST", "/admin/tenants", 201, json={"external_id": "tpa-a", "name": "Synthetic TPA", "type": "tpa"})
    await call("PATCH", f"/admin/tenants/{tpa['id']}", 200, json={"name": "Synthetic TPA Renamed"})

    delegation = await call(
        "POST", "/admin/tpa-delegations", 201, json={"tpa_tenant_id": tpa["id"], "insurer_tenant_id": insurer["id"]}
    )
    await call("PATCH", f"/admin/tpa-delegations/{delegation['id']}", 200, json={})
    await call("PATCH", f"/admin/tenants/{tpa['id']}", 200, json={"status": "disabled"})

    permissions = (await call("GET", "/admin/permissions", 200))["items"]
    audit_read = next(p["id"] for p in permissions if p["code"] == "audit:read")
    finance = await factory.role_id("insurer-finance")
    await call("POST", f"/admin/roles/{finance}/permissions", 201, json={"permission_id": audit_read})
    await call("DELETE", f"/admin/roles/{finance}/permissions/{audit_read}", 204)

    link = await call(
        "POST",
        "/admin/patient-member-links",
        201,
        json={"user_id": str(uuid.uuid4()), "member_id": "00000000-0000-4000-8000-0000000000aa"},
    )
    await call("DELETE", f"/admin/patient-member-links/{link['id']}", 204)

    # A rejected change (duplicate external_id) leaves no audit row.
    await call("POST", "/admin/tenants", 409, json={"external_id": "ins-a", "name": "Dup", "type": "insurer"})

    events = list(await session.scalars(select(AuditEvent)))
    assert Counter(e.action for e in events) == Counter(
        {
            "tenant.created": 2,
            "tenant.updated": 1,
            "tenant.disabled": 1,
            "tpa_delegation.created": 1,
            "tpa_delegation.ended": 1,
            "role.permission_granted": 1,
            "role.permission_revoked": 1,
            "patient_member_link.created": 1,
            "patient_member_link.deleted": 1,
        }
    )
    assert {e.actor_user_id for e in events} == {admin_sub}

    token = headers["Authorization"].removeprefix("Bearer ")
    assert token not in json.dumps([e.metadata_ for e in events])
