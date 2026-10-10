# Claimwise API Contract v0.1

**Status:** PROPOSED — pending D03 sign-off
**Owner:** Tristan/Brian
**Consumers:** Ingrid, Lameck (frontend), Obunde (backend), Silas (docs)

## What This Is

The frozen API contract for the Claimwise demonstration. Every frontend and backend task builds against this spec. If a request or response is not in here, it does not exist for v0.1.

## Files

| File | Purpose |
|---|---|
| `openapi.yaml` | Full OpenAPI 3.1 specification |
| `examples/case-001-request.json` | Case 001 claim submission payload |
| `examples/case-001-response.json` | Case 001 validation and settlement response |

## Money Format

All money is `{ "amount_minor": <int>, "currency": "KES" }`.

`KES 36,100.00` = `{ "amount_minor": 3610000, "currency": "KES" }`.

Never divide or round in the frontend without matching the contract. Never use floating point.

## Versioning Rules

- v0.1 is frozen pending D03.
- Breaking changes require a version bump to v0.2 and team notification.
- New endpoints may be added in minor revisions without breaking clients.
- Field additions are backward-compatible. Field removals are not.

## Idempotency

Mutating endpoints that create financial or state effects require an `Idempotency-Key` header. Retries with the same key return the original response.

## What This Contract Does Not Cover

- Authentication routes (blocked by D04)
- Rule configuration endpoints (blocked by D05, D06)
- Import and appeal APIs (blocked by D03, D04, D06, D10)
- FHIR mapping (blocked by D10)

## Change Log

| Version | Date | Change | Author |
|---|---|---|---|
| 0.1 | 2026-10-09 | Initial contract | Tristan/Brian |
