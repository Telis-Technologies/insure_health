"""Keycloak token verification and principal resolution."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

pytestmark = pytest.mark.anyio

ME = "/api/v1/auth/me"


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_valid_keycloak_token_resolves_principal(client, factory):
    hospital = await factory.tenant("hospital")
    sub = uuid.uuid4()

    response = await client.get(ME, headers=factory.auth(["provider-biller"], hospital, sub=sub))

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == str(sub)
    assert body["user_type"] == "tenant_user"
    assert body["username"] == "synthetic.user"
    assert body["organization"]["external_id"] == hospital.external_id
    assert body["roles"] == ["provider-biller"]  # Keycloak default roles are ignored
    assert "claims:submit" in body["permissions"]
    assert "claims:approve" not in body["permissions"]


async def test_invalid_tokens_are_401(client, factory):
    insurer = await factory.tenant("insurer")
    good = factory.claims(["insurer-claims-approver"], insurer)
    now = datetime.now(UTC)

    def without(claim: str) -> dict:
        return {k: v for k, v in good.items() if k != claim}

    bad_tokens = [
        "not-a-jwt",
        factory.token(good, key=factory.other_key),  # not signed by Keycloak
        factory.token({**good, "exp": now - timedelta(seconds=1)}),  # expired
        factory.token({**good, "iss": "http://evil.example.test/realms/claimwise"}),  # wrong issuer
        factory.token({**good, "aud": ["account"]}),  # not issued for this API
        factory.token(without("exp")),
        factory.token(without("sub")),
        factory.token({**good, "sub": "not-a-uuid"}),
        jwt.encode(good, "a-shared-secret-that-is-long-enough!!", algorithm="HS256"),  # alg switch
    ]
    for token in bad_tokens:
        response = await client.get(ME, headers=_bearer(token))
        assert response.status_code == 401, token[:40]
        assert response.json()["error"]["code"] == "not_authenticated"

    assert (await client.get(ME)).status_code == 401
    assert (await client.get(ME, headers={"Authorization": "Basic dXNlcjpwYXNz"})).status_code == 401
    assert (await client.get(ME, headers=_bearer(factory.token(good)))).status_code == 200


async def test_unregistered_missing_or_multiple_organizations_are_403(client, factory):
    insurer = await factory.tenant("insurer")
    other = await factory.tenant("insurer")

    for organization in ["no-such-org", None, [insurer.external_id, other.external_id]]:
        response = await client.get(ME, headers=factory.auth(["insurer-finance"], organization))
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "organization_not_registered"


async def test_disabled_organization_is_401(client, factory):
    insurer = await factory.tenant("insurer", status="disabled")

    assert (await client.get(ME, headers=factory.auth(["insurer-finance"], insurer))).status_code == 401


async def test_roles_not_matching_organization_type_grant_nothing(client, factory):
    insurer = await factory.tenant("insurer")

    response = await client.get(
        "/probe/whoami", headers=factory.auth(["provider-biller", "tpa-reviewer", "unknown-role"], insurer)
    )

    assert response.status_code == 200
    assert response.json() == {"permissions": [], "roles": []}


async def test_platform_admin_and_patient_need_no_organization(client, factory):
    admin = await client.get(ME, headers=factory.platform_admin())
    assert admin.status_code == 200
    assert admin.json()["user_type"] == "platform_admin"
    assert admin.json()["organization"] is None

    patient = await client.get(ME, headers=factory.auth(["patient"]))
    assert patient.status_code == 200
    assert patient.json()["user_type"] == "patient"
    assert patient.json()["roles"] == ["patient"]


async def test_platform_admin_role_ignores_other_roles_in_token(client, factory):
    insurer = await factory.tenant("insurer")

    whoami = await client.get(
        "/probe/whoami", headers=factory.auth(["platform-admin", "insurer-claims-approver"], insurer)
    )

    assert whoami.json()["roles"] == ["platform-admin"]
    assert "claims:approve" not in whoami.json()["permissions"]
