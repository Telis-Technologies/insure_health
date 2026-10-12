# Decision log

## 2026-10-10 — Lameck

Lameck approved the following frontend-scope directions. Linked decision records preserve remaining open implementation details rather than treating a partial answer as a complete team-wide decision:

- D02: Health claims-and-rules slice; synthetic Case 001; structured preauthorization request/review. History/consent and OCR, anomaly/AI, biometrics, WhatsApp and USSD are deferred from this slice.
- D03: Use proposed REST/OpenAPI v0.1 as the frontend direction and extend it for policy/rule catalogue and version history. Unavailable APIs must be represented honestly. The scaffold uses Next.js App Router/TypeScript, Next 16.4.0 and React 19.3.0; Node.js >=20.9.0 is required. Shared error/nullable semantics and final cross-team contract details remain open.
- D04: Provider billers submit/respond; insurer or TPA reviewers assess/request corrections; claim approval requires explicit authority; finance records payment/reconciliation without changing adjudication. TPA publication requires explicit insurer delegation. Lameck has now selected Keycloak for identity and Auth.js as the Next.js OIDC/session integration, using authorization-code + PKCE. Reuse the existing backend `access` module boundary; its implementation is currently a placeholder. Tenant membership, backend token enforcement, exact role grants, provisioning workflow and production deployment remain open.
- D05: Service date governs selection of applicable policy, provider agreement/tariff, authorization and rule versions. Remaining field/coding decisions remain open.
- D06: Case 001 amounts are fixture-only; other policies require their own approved configuration; display API-calculated amounts; payments are simulated; partial-payment and reversal flows are deferred.
- D07/D09: History/consent and anomaly scoring are deferred from this slice.
- D08: Show operational queues, aging, payment and reconciliation; loss ratio is unavailable until approved inputs and definitions exist.
- D10: Synthetic attachment UI only; no live storage/integration. File limits, storage, retention and OCR remain open.

Lameck approved the D15 publication guardrails on 2026-10-10: every policy/rule publication requires an independent insurer-authorized approver distinct from the author; a TPA may publish only under explicit, scoped insurer delegation. D15 remains OPEN for the exact accountable insurer business-owner and drafter roles, delegation scope details, and any additional compliance sign-off.

For multi-insurer growth, the current implementation uses one Keycloak realm and models insurer customers as tenants, with user tenant/organization attributes and application roles. This is an initial deployment shape, not a final database-isolation decision: all APIs must verify signed tokens and enforce tenant membership server-side; tenant-owned records must carry tenant scope. Never rely on the frontend navigation filter as the access-control boundary.

Implementation recommendation for the remaining D15 role design: make an insurer product/benefits owner accountable, let a trained configuration analyst draft, and require an independent insurer-authorized approver to publish. Exact job titles and additional compliance sign-off vary by insurer and need team confirmation.

Reference points for that recommendation: Guidewire describes assigning API roles to callers and selecting effective product editions; Salesforce documents a permission set for creating product underwriting rules; NIST describes separation of duties as dividing critical tasks across roles. These are examples of implementation patterns, not a universal insurance job-title standard: [Guidewire API roles](https://docs.guidewire.com/cloud/pc/202511/cloudapica/cloudAPI/topics/703-AuthImplement/02-endpoint-access/c_assigning-API-roles-to-callers.html), [Guidewire effective-dated editions](https://docs.guidewire.com/cloud/apd/olos/create/topics/c_editions.html), [Salesforce underwriting rules](https://help.salesforce.com/s/articleView?id=ind.insurance_admin_product_underwriting_rules.htm&language=en_US&type=5), [NIST separation of duties](https://csrc.nist.gov/glossary/term/separation_of_duty), and [NIST SP 800-128](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-128.pdf).

## 2026-10-12 — Obunde (D04 conflict)

**Conflict found.** D04 had two incompatible answers:

| | Lameck, 2026-10-10 (this log) | Obunde, 2026-10-11 (T06 task brief) |
| --- | --- | --- |
| Identity provider | Keycloak; Auth.js OIDC authorization code + PKCE in Next.js | Backend email + password login (argon2), backend-signed HS256 JWTs |
| Users stored in | Keycloak | Postgres `users` |
| Roles | 10 job roles in `infra/keycloak/claimwise-realm.json`: `platform-admin`, `tenant-admin`, `provider-biller`, `tpa-reviewer`, `insurer-claims-adjudicator`, `insurer-claims-approver`, `insurer-finance`, `insurer-policy-author`, `insurer-policy-approver`, `auditor` | 5 roles: `platform_admin`, `insurer_admin`, `tpa_admin`, `hospital_admin`, `patient` |
| Tenancy | `tenant_ids` = insurer customer; `organization_ids` = the user's provider/TPA/insurer organization (token attributes) | `users.tenant_id` = one tenant of type insurer, hospital or tpa |

T06 was first built to the brief (backend login, 5 roles; migrations `0002_access`, `0003_access_seed`). Keycloak tokens would have been rejected by that backend. A third role set exists in Tristan/Brian's proposed DDL (`role_enum` in `db/schema/001_initial.sql`, `docs/erd.md`).

**Answer (D04, Obunde, 2026-10-12):** "for now lets stick with lameck s10 ... and use keycloak". Keycloak is the identity provider and Lameck's 10 realm roles are the application roles. The backend verifies Keycloak-signed access tokens; it does not issue its own tokens or store passwords.

**Superseded:** the backend email/password login, JWT_SECRET token signing and the 5-role seed from the T06 brief. T06 is reworked to verify Keycloak tokens.

**Affected:** T06 (rework), T03 (contract security scheme: Keycloak bearer token), T05 (frontend must send the Keycloak access token to the API), T07/T02 (Tristan/Brian's `role_enum` should align with the 10 roles), T17 (no patient role among the 10; history/consent is deferred from this slice per D07).

**Follow-up answers (D04, Obunde, 2026-10-12)** for the T06 rework:

1. **Revocation:** roles come from the verified Keycloak token, and the permissions for each role are stored in Postgres. Organization disables and permission changes apply on the next request. Removing a role or disabling a user in Keycloak applies when the token expires (Keycloak default 5 minutes).
2. **Grants approved:**

   | Role | Permissions |
   | --- | --- |
   | `platform-admin` | `tenants:manage`, `roles:manage` |
   | `tenant-admin` | `audit:read` |
   | `provider-biller` | `claims:read`, `claims:create`, `claims:submit`, `claims:correct`, `coverage:read`, `contracts:read`, `payments:read` |
   | `tpa-reviewer` | `claims:read`, `claims:review`, `corrections:request`, `coverage:read`, `contracts:read` |
   | `insurer-claims-adjudicator` | `claims:read`, `claims:review`, `corrections:request`, `coverage:read`, `contracts:read` |
   | `insurer-claims-approver` | `claims:read`, `claims:approve`, `coverage:read`, `contracts:read` |
   | `insurer-finance` | `claims:read`, `payments:read`, `payments:record`, `reconciliation:perform`, `reports:read` |
   | `insurer-policy-author` | `coverage:read`, `contracts:read`, `policies:draft` |
   | `insurer-policy-approver` | `coverage:read`, `contracts:read`, `policies:publish` |
   | `auditor` | `audit:read` |

   `history:read` and `consent:manage` are granted to no role while D07 is deferred.
3. **Patient:** keep `patient` as an 11th role, added to `infra/keycloak/claimwise-realm.json` with group `patients`. It is granted `claims:read`, `coverage:read` and `payments:read`; patients are scoped through `patient_member_links`. Needs Lameck's review of his realm file and a demo patient user in his repair script.
4. **TPA reports:** `tpa-reviewer` does not get `reports:read` (nor `payments:read`). The frontend currently routes `tpa-reviewer` to `/reports`; the API will return 403 there.

**Implementation detail approved with the T06 plan:** `platform-admin` also holds `users:manage`, used only for the patient-member-link endpoints. Organizations are registered in the backend with `external_id` equal to the Keycloak `organization_ids` value; a user needs exactly one registered, active organization (except `platform-admin` and `patient`). Token `tenant_ids` is not used for scope.

**Still OPEN in D04:** consent ownership; TPA read access to payments and reports; whether TPA users may have more than one organization; production deployment.

For each new answer record decision ID, exact answer, answering person, date, affected requirements/tasks, contract changes and evidence. Do not close OPEN entries without an answer.
