"""Spec item 7: scope helpers, using a VALUES stub instead of a claims table."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import String, column, select, values
from sqlalchemy.dialects.postgresql import UUID

from app.core.errors import AppError
from app.modules.access.models import PatientMemberLink, TpaDelegation
from app.modules.access.services import ensure_history_access, ensure_in_scope, is_in_scope, scope_clause

pytestmark = pytest.mark.anyio


@dataclass
class StubClaim:
    ref: str
    insurer_tenant_id: uuid.UUID
    provider_tenant_id: uuid.UUID
    member_id: uuid.UUID


@pytest.fixture
async def world(factory):
    """Two insurers, two hospitals, one TPA, three members, three stub claims."""
    insurer_a, insurer_b = await factory.tenant("insurer"), await factory.tenant("insurer")
    hospital_a, hospital_b = await factory.tenant("hospital"), await factory.tenant("hospital")
    tpa = await factory.tenant("tpa")
    members = [uuid.uuid4() for _ in range(3)]
    claims = [
        StubClaim("c1", insurer_a.id, hospital_a.id, members[0]),
        StubClaim("c2", insurer_a.id, hospital_b.id, members[1]),
        StubClaim("c3", insurer_b.id, hospital_b.id, members[2]),
    ]
    return {
        "insurer_a": insurer_a,
        "insurer_b": insurer_b,
        "hospital_a": hospital_a,
        "hospital_b": hospital_b,
        "tpa": tpa,
        "members": members,
        "claims": claims,
    }


async def _visible(session, principal, claims) -> set[str]:
    """Run the list filter in SQL against a VALUES stub of claim rows."""
    stub = values(
        column("ref", String),
        column("insurer_tenant_id", UUID(as_uuid=True)),
        column("provider_tenant_id", UUID(as_uuid=True)),
        column("member_id", UUID(as_uuid=True)),
        name="stub_claims",
    ).data([(c.ref, c.insurer_tenant_id, c.provider_tenant_id, c.member_id) for c in claims])
    stmt = select(stub.c.ref).where(
        scope_clause(principal, stub.c.insurer_tenant_id, stub.c.provider_tenant_id, stub.c.member_id)
    )
    return set(await session.scalars(stmt))


async def _user_principal(factory, tenant, role):
    return await factory.principal([role], tenant)


async def test_hospitals_see_only_their_own_claims(session, factory, world):
    claims = world["claims"]
    hospital_a = await _user_principal(factory, world["hospital_a"], "provider-biller")
    hospital_b = await _user_principal(factory, world["hospital_b"], "provider-biller")

    assert await _visible(session, hospital_a, claims) == {"c1"}
    assert await _visible(session, hospital_b, claims) == {"c2", "c3"}
    assert await is_in_scope(session, hospital_a, claims[0]) is True
    assert await is_in_scope(session, hospital_a, claims[1]) is False


async def test_insurers_see_only_their_own_claims(session, factory, world):
    claims = world["claims"]
    insurer_a = await _user_principal(factory, world["insurer_a"], "insurer-claims-adjudicator")
    insurer_b = await _user_principal(factory, world["insurer_b"], "insurer-claims-adjudicator")

    assert await _visible(session, insurer_a, claims) == {"c1", "c2"}
    assert await _visible(session, insurer_b, claims) == {"c3"}
    assert await is_in_scope(session, insurer_b, claims[0]) is False


async def test_tpa_sees_insurer_claims_only_during_active_delegation(session, factory, world):
    claims = world["claims"]
    admin_id = uuid.uuid4()
    tpa = await _user_principal(factory, world["tpa"], "tpa-reviewer")
    now = datetime.now(UTC)

    assert await _visible(session, tpa, claims) == set()

    future = TpaDelegation(
        tpa_tenant_id=world["tpa"].id,
        insurer_tenant_id=world["insurer_b"].id,
        valid_from=now + timedelta(days=1),
        created_by=admin_id,
    )
    expired = TpaDelegation(
        tpa_tenant_id=world["tpa"].id,
        insurer_tenant_id=world["insurer_b"].id,
        valid_from=now - timedelta(days=10),
        valid_to=now - timedelta(seconds=1),
        created_by=admin_id,
    )
    session.add_all([future, expired])
    await session.flush()
    assert await _visible(session, tpa, claims) == set()

    active = TpaDelegation(
        tpa_tenant_id=world["tpa"].id,
        insurer_tenant_id=world["insurer_a"].id,
        valid_from=now - timedelta(hours=1),
        created_by=admin_id,
    )
    session.add(active)
    await session.flush()
    assert await _visible(session, tpa, claims) == {"c1", "c2"}
    assert await is_in_scope(session, tpa, claims[0]) is True
    assert await is_in_scope(session, tpa, claims[2]) is False

    active.valid_to = datetime.now(UTC)
    await session.flush()
    assert await _visible(session, tpa, claims) == set()
    assert await is_in_scope(session, tpa, claims[0]) is False


async def test_tpa_delegation_ended_via_api_removes_scope(client, session, factory, world):
    admin = factory.platform_admin()
    tpa = await _user_principal(factory, world["tpa"], "tpa-reviewer")
    created = await client.post(
        "/api/v1/admin/tpa-delegations",
        json={"tpa_tenant_id": str(world["tpa"].id), "insurer_tenant_id": str(world["insurer_a"].id)},
        headers=admin,
    )
    assert created.status_code == 201
    assert await _visible(session, tpa, world["claims"]) == {"c1", "c2"}

    ended = await client.patch(f"/api/v1/admin/tpa-delegations/{created.json()['id']}", json={}, headers=admin)
    assert ended.status_code == 200
    assert ended.json()["valid_to"] is not None
    assert await _visible(session, tpa, world["claims"]) == set()
    again = await client.patch(f"/api/v1/admin/tpa-delegations/{created.json()['id']}", json={}, headers=admin)
    assert again.status_code == 409


async def test_patient_sees_only_linked_members(session, factory, world):
    patient_sub = uuid.uuid4()
    session.add(PatientMemberLink(user_id=patient_sub, member_id=world["members"][1], created_by=uuid.uuid4()))
    await session.flush()
    patient = await factory.principal(["patient"], sub=patient_sub)
    unlinked = await factory.principal(["patient"])

    assert await _visible(session, patient, world["claims"]) == {"c2"}
    assert await _visible(session, unlinked, world["claims"]) == set()
    assert await is_in_scope(session, patient, world["claims"][1]) is True
    assert await is_in_scope(session, patient, world["claims"][0]) is False


async def test_platform_admin_is_never_in_scope(session, factory, world):
    admin = await factory.principal(["platform-admin"])

    assert await _visible(session, admin, world["claims"]) == set()
    for claim in world["claims"]:
        assert await is_in_scope(session, admin, claim) is False


async def test_ensure_in_scope_raises_404_for_out_of_scope_or_missing(session, factory, world):
    hospital_a = await _user_principal(factory, world["hospital_a"], "provider-biller")

    await ensure_in_scope(session, hospital_a, world["claims"][0], "Claim")
    for record in (world["claims"][2], None):
        with pytest.raises(AppError) as exc:
            await ensure_in_scope(session, hospital_a, record, "Claim")
        assert exc.value.status_code == 404
        assert exc.value.message == "Claim not found."


async def test_history_access_is_refused_until_consent_check_exists(session, factory, world):
    insurer = await _user_principal(factory, world["insurer_a"], "insurer-claims-adjudicator")
    assert not insurer.has("history:read")  # granted to nobody while D07 is deferred

    with pytest.raises(AppError) as exc:
        await ensure_history_access(session, insurer, world["members"][0])
    assert exc.value.code == "consent_check_unavailable"
