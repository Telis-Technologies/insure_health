"""Revocation: backend-side changes apply on the next request; Keycloak-side changes at token expiry."""

import pytest

pytestmark = pytest.mark.anyio


async def test_revoking_role_permission_takes_effect_immediately(client, factory):
    admin = factory.platform_admin()
    insurer = await factory.tenant("insurer")
    approver = factory.auth(["insurer-claims-approver"], insurer)
    assert (await client.post("/probe/claims-approve", headers=approver)).status_code == 200

    permissions = (await client.get("/api/v1/admin/permissions", headers=admin)).json()["items"]
    approve_id = next(p["id"] for p in permissions if p["code"] == "claims:approve")
    role_id = await factory.role_id("insurer-claims-approver")
    revoked = await client.delete(f"/api/v1/admin/roles/{role_id}/permissions/{approve_id}", headers=admin)
    assert revoked.status_code == 204

    assert (await client.post("/probe/claims-approve", headers=approver)).status_code == 403


async def test_disabling_organization_rejects_existing_tokens(client, factory):
    admin = factory.platform_admin()
    insurer = await factory.tenant("insurer")
    finance = factory.auth(["insurer-finance"], insurer)
    assert (await client.get("/api/v1/auth/me", headers=finance)).status_code == 200

    patched = await client.patch(f"/api/v1/admin/tenants/{insurer.id}", json={"status": "disabled"}, headers=admin)
    assert patched.status_code == 200
    assert patched.json()["status"] == "disabled"

    assert (await client.get("/api/v1/auth/me", headers=finance)).status_code == 401


async def test_role_removed_in_keycloak_applies_with_the_next_token(client, factory):
    """Keycloak owns role assignment: the next token it issues no longer carries the role."""
    insurer = await factory.tenant("insurer")
    sub = "6a6f8c1e-6f0e-4c39-9f3c-2b1d7c0e9a11"

    before = factory.auth(["insurer-claims-approver"], insurer, sub=sub)
    after = factory.auth([], insurer, sub=sub)

    assert (await client.post("/probe/claims-approve", headers=before)).status_code == 200
    assert (await client.post("/probe/claims-approve", headers=after)).status_code == 403
