"""Admin validation: organizations, role permission guards, delegations."""

import pytest

pytestmark = pytest.mark.anyio


async def test_organization_external_id_is_unique_and_validated(client, factory):
    admin = factory.platform_admin()

    created = await client.post(
        "/api/v1/admin/tenants",
        json={"external_id": "PRO-TEST-01", "name": "Synthetic Clinic", "type": "hospital"},
        headers=admin,
    )
    assert created.status_code == 201
    assert created.json()["external_id"] == "PRO-TEST-01"

    duplicate = await client.post(
        "/api/v1/admin/tenants",
        json={"external_id": "PRO-TEST-01", "name": "Other", "type": "hospital"},
        headers=admin,
    )
    assert duplicate.status_code == 409

    for bad in ["", "has space", "../etc", "x" * 101]:
        response = await client.post(
            "/api/v1/admin/tenants", json={"external_id": bad, "name": "N", "type": "insurer"}, headers=admin
        )
        assert response.status_code == 422, bad


async def test_registered_organization_unlocks_keycloak_user(client, factory):
    admin = factory.platform_admin()
    biller = factory.auth(["provider-biller"], "PRO-NEW-01")

    assert (await client.get("/api/v1/auth/me", headers=biller)).status_code == 403
    await client.post(
        "/api/v1/admin/tenants",
        json={"external_id": "PRO-NEW-01", "name": "Synthetic Clinic", "type": "hospital"},
        headers=admin,
    )
    assert (await client.get("/api/v1/auth/me", headers=biller)).status_code == 200


async def test_admin_permissions_reserved_to_platform_admin(client, factory):
    admin = factory.platform_admin()
    permissions = (await client.get("/api/v1/admin/permissions", headers=admin)).json()["items"]
    by_code = {p["code"]: p["id"] for p in permissions}

    platform_role = await factory.role_id("platform-admin")
    response = await client.post(
        f"/api/v1/admin/roles/{platform_role}/permissions", json={"permission_id": by_code["claims:read"]}, headers=admin
    )
    assert response.status_code == 422

    tenant_admin = await factory.role_id("tenant-admin")
    response = await client.post(
        f"/api/v1/admin/roles/{tenant_admin}/permissions", json={"permission_id": by_code["tenants:manage"]}, headers=admin
    )
    assert response.status_code == 422

    finance = await factory.role_id("insurer-finance")
    duplicate = await client.post(
        f"/api/v1/admin/roles/{finance}/permissions", json={"permission_id": by_code["reports:read"]}, headers=admin
    )
    assert duplicate.status_code == 409


async def test_delegation_requires_tpa_and_insurer_tenants(client, factory):
    admin = factory.platform_admin()
    tpa = await factory.tenant("tpa")
    insurer = await factory.tenant("insurer")
    hospital = await factory.tenant("hospital")

    for tpa_id, insurer_id in [(hospital.id, insurer.id), (insurer.id, tpa.id)]:
        response = await client.post(
            "/api/v1/admin/tpa-delegations",
            json={"tpa_tenant_id": str(tpa_id), "insurer_tenant_id": str(insurer_id)},
            headers=admin,
        )
        assert response.status_code == 422

    ok = await client.post(
        "/api/v1/admin/tpa-delegations",
        json={"tpa_tenant_id": str(tpa.id), "insurer_tenant_id": str(insurer.id)},
        headers=admin,
    )
    assert ok.status_code == 201


async def test_patient_link_is_unique(client, factory):
    admin = factory.platform_admin()
    body = {"user_id": "00000000-0000-4000-8000-0000000000b1", "member_id": "00000000-0000-4000-8000-0000000000c1"}

    assert (await client.post("/api/v1/admin/patient-member-links", json=body, headers=admin)).status_code == 201
    assert (await client.post("/api/v1/admin/patient-member-links", json=body, headers=admin)).status_code == 409
