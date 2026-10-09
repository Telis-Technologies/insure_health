# Claimwise Software Requirements

Defines proposed software contracts, confirmed reference behavior, interfaces, acceptance tests and explicit decision dependencies for AI assisted implementation.

Version 0.1 | 9 October 2026 | One week demonstration

## System baseline and architecture

Version 0.1 dated 9 October 2026. The confirmed stack is Next.js with TypeScript, FastAPI and PostgreSQL. This SRS proposes a single FastAPI application organized into domain modules. Framework-specific implementation details and API schemas are subject to D03; authorization, finance and external data semantics remain blocked by their named decisions.

Read requirement basis values literally: CONFIRMED_SCOPE_OR_STRATEGY states accepted project direction; REFERENCE_ONLY applies solely to the fictional case; PROPOSED_DETAIL requires the relevant decision or reviewed specification to be confirmed. Agents may analyze and prepare isolated tests while blocked, but must not present proposed behavior as a team decision.

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Next.js frontend | Forms, reviewer screens, consent controls and reports. | No authoritative financial calculation or browser-only authorization. |
| FastAPI application | Business actions, validation, decisions and access checks. | Use separate routers/services by domain; no client-controlled workflow status. |
| PostgreSQL | Versioned claims, assessment records, grants and financial/audit entries. | Transactions protect linked changes; no floating-point money. |
| Document store | Private originals and corrected supporting documents. | Storage provider and upload constraints OPEN in D10. |
| External adapters | CSV/JSON or authorized partner integration. | Mock mode is visible; no assumed access to DHA/SHA or biometric systems. |
| Worker if needed | Long document processing or imports. | Queue library and need for asynchronous processing OPEN in D03 D10. |

### Proposed module and repository ownership

Proposed modules: access, coverage, provider agreements, claims, assessment, review, history and consent, settlement, reporting, audit and adapters. Proposed repository layout: frontend, backend, contracts, fixtures and docs. These are proposals for D03, not an existing repository or an instruction to create duplicate projects.

### FR01 Capability truthfulness

Each user-visible feature shall disclose working behavior, synthetic input, mocked integration or unavailable capability as applicable.

Acceptance: The demo and pitch use matching labels; mocks are not counted as live integrations. Decision dependencies: D02.

### FR02 Data provenance

Financial and clinical inputs shall retain source, input mode and version. Missing required inputs shall remain unknown and block the dependent result.

Acceptance: No field is filled with an invented premium, history entry or national ID; unknown loss ratio is unavailable. Decision dependencies: D05, D07, D08.

## Data records and ownership

These are proposed record boundaries for D03 and D05. Keys, field names and cardinalities are implementation contracts to freeze before parallel code. Every cross-organization reference must be checked against the access model in D04; a single tenant_id by itself does not describe a provider serving several insurers.

| Record group | Minimum information or relationship |
| --- | --- |
| Organization and user access | Insurer/provider/TPA identity, user identity, role and explicitly delegated organization or portfolio access. |
| Member and external identifier | Internal member key; identifiers scoped by issuing system. Do not derive a global patient identity from names. |
| Policy and benefit period | Insurer/member links, effective dates, benefit type, limits and applicable financial configuration. |
| Provider contract and tariff version | Provider and insurer, effective dates, service identifiers, agreed rates and exclusions. |
| Encounter and authorization | Member/provider/service context; authorization status, named service, validity, ceiling and evidence. |
| Claim and claim version | Stable claim key; immutable submitted versions; provider bill reference and submitted bill lines. |
| Document version | Private storage reference, source, content hash and link to the claim version or encounter. |
| Validation run and finding | Claim version, rule/contract/policy versions, result, affected lines, evidence and proposed correction. |
| Review and correction request | Actor, reason, finding decisions, requested evidence and corrected version links. |
| History and consent grant | Synthetic record provenance; member, recipient, purpose, scope, expiry and withdrawal state as agreed. |
| Settlement and benefit entries | Approved claim version, amounts, reservation/posting/reversal references and reasons. |
| Payment and receipt allocation | Payment identity, reference, amount, date and allocation to an approved payable. |
| Reporting input batch | Cohort, period, input definitions, approved premium/reserve values and source timestamp. |
| Audit event | Actor, organization context, action, affected record/version, time and reason; no full clinical text in logs. |

### FR03 Reference fixture isolation

Case 001 terms shall be attached to its policy and contract fixture.

Acceptance: Another policy is not assigned 10% coinsurance or a KES 100,000 limit by default.

## Claims intake and supporting evidence

### FR04 Claim intake

An authorized provider user shall create a structured draft claim against an identifiable member, policy, provider and encounter. Required fields and coding are defined by the approved schema.

Acceptance: Incomplete drafts may be saved if the schema permits; submission rejects missing required fields and identifies each missing field. Decision dependencies: D04, D05.

### FR05 Submission versions

Submitting a claim shall preserve the bill lines and source references as an immutable version. Provider correction shall create a linked new version.

Acceptance: The original KES 36,100 bill remains inspectable after the KES 29,700 corrected version is submitted. Decision dependencies: D03.

### FR06 Authorization evidence

The claim shall link the named service, authorization validity and ceiling without treating authorization as blanket payment approval.

Acceptance: Case 001 links AUTH-001 to MRI brain without contrast on 22 September 2026 and applies its KES 25,000 ceiling.

### FR07 Preauthorization creation

If D02 includes creation, an authorized user shall submit an explicit service request and a designated reviewer shall record approval or clarification with evidence.

Acceptance: The request and resulting authorization are distinct records; no automatic clinical approval or default ceiling. Decision dependencies: D02, D04, D05.

### FR08 Evidence retrieval

Access to original bills, contracts, authorizations and clinical documents shall be checked by the API or document gateway.

Acceptance: A user outside the agreed organization or purpose cannot retrieve a document by guessing its URL. Decision dependencies: D04, D10.

### FR09 Extraction mode

If OCR is selected, extracted values shall be staged with source references and require the agreed verification process before financial assessment.

Acceptance: Wrong extracted quantities or amounts can be corrected; a mocked extractor is labelled and never reported as OCR accuracy. Decision dependencies: D02, D10.

### FR10 Submission channels

Any enabled channel shall map into the same approved claim schema and preserve source/provenance.

Acceptance: WhatsApp, USSD and biometric sign-off remain unavailable until D02 D10 select a mode and authorized contract. Decision dependencies: D02, D10.

## Assessment and review behavior

### FR11 Versioned assessment

A validation run shall identify the claim, policy, contract and rule versions used, and retain findings after later configuration changes.

Acceptance: Updating a tariff does not silently rewrite a previous run; revalidation creates a new run. Decision dependencies: D03.

### FR12 Explainable rules

Each finding shall state affected line, rule identifier, source evidence, observed value and proposed treatment.

Acceptance: Case 001 identifies L01 500, L02 300, L03 3000, L05 1800 and L06 800 in KES corrections.

### FR13 Correction deduplication

Calculation shall resolve overlapping adjustments explicitly rather than summing every flagged rule.

Acceptance: The MRI correction is KES 3,000 once. The removed duplicate CBC receives no second tariff correction.

### FR14 Human review

A finding shall not automatically establish fraud or trigger an unreviewed denial. Review decisions shall identify actor and reason.

Acceptance: An unresolved or clarification finding cannot be approved through the normal path. Overrides require the agreed authority, justification and recalculation. Decision dependencies: D04, D06.

### FR15 Provider correction loop

The reviewer shall issue a correction or evidence request; the provider shall correct or dispute it; the reviewer shall evaluate the response.

Acceptance: Correction request, original version, corrected version and final decision remain linked. A UI confirmation alone is not provider evidence. Decision dependencies: D04, D05.

### FR16 Anomaly behavior

The selected anomaly method shall output an explanation and provenance separately from deterministic contractual corrections.

Acceptance: Legitimate repeat services are reviewable. No unexplained score, assumed threshold, fabricated model output or automatic denial. Decision dependencies: D09.

### Proposed workflow for D03 and D06

Draft -> Submitted -> Validated -> Under review -> Approved -> Payment pending -> Paid -> Reconciled. Correction requested -> Corrected version submitted -> Validated returns to review. Clarification holds review. Rejection and appeal routes require agreed actors and conditions. Missing branches are not replaced by arbitrary status edits.

Transition authority belongs in the backend. The API shall verify current version, actor, unresolved findings and any required correction evidence. A stale assessment or concurrent change must prevent approval of the wrong version. Exact rejection/appeal semantics remain OPEN in D04 D06.

## Settlement benefit and payment integrity

### FR17 Reference calculation

The Case 001 calculation shall return billed 36100, correction 6400, eligible 29700, member share 2970 and insurer share 26730, all KES.

Acceptance: Stored and API-returned totals match those amounts; the frontend displays authoritative totals.

### FR18 General financial calculation

A policy-specific configuration shall define any deductible, coinsurance, limit, exclusion, rounding and responsibility rule. Missing configuration shall block calculation.

Acceptance: No general claim inherits Case 001 values; the calculation reports a missing-config state. Decision dependencies: D06.

### FR19 Benefit ledger

Benefit entries shall represent reservation, consumption, release and reversal according to the approved accounting point.

Acceptance: Two claims cannot spend the same availability. Case 001 leaves KES 55,270 after posting KES 26,730; conversion of a reservation to use does not deduct twice. Decision dependencies: D06.

### FR20 Atomic approval

Approval shall record the approved version, required benefit action and audit event as one consistent database operation.

Acceptance: A failing operation leaves no approved claim without its required financial record; a stale version is rejected. Decision dependencies: D03, D06.

### FR21 Simulated payments

The week shall record simulated payments without sending funds. Payment reference and allocations shall identify the intended payable.

Acceptance: Case 001 records KES 26,730 and visibly states simulation; no payment gateway or bank transfer is executed.

### FR22 Reconciliation

Receipt matching shall distinguish approved payable, paid amount, matched amount and unresolved variance.

Acceptance: An exact KES 26,730 match yields KES 0 variance. A partial or mismatched receipt cannot appear fully reconciled. Decision dependencies: D06.

### FR23 Idempotency and reversals

Repeated submit/approve/payment requests shall not duplicate versions or financial effects; reversals shall be separate linked entries.

Acceptance: A retried approved command returns the agreed existing result or conflict; no second payment is created. Partial-payment and reversal rules are selected in D06. Decision dependencies: D03, D06.

Recommended financial implementation: database transactions with row-level locking or equivalent concurrency control; exact decimal or integer minor-unit money; explicit currency; and unique source identifiers/idempotency keys. D03 selects the representation; agents must not use binary floats for money.

## History consent and reporting

### FR24 Purpose scoped history

A history request shall identify member, recipient, purpose and requested scope. Claims access shall not automatically authorize care or underwriting-history sharing.

Acceptance: An unauthorized recipient cannot retrieve history by calling the API directly. Decision dependencies: D04, D07.

### FR25 Grant and withdrawal

The selected consent mechanism shall record an authenticated member action or explicitly identified demonstration simulation, scope, expiry and withdrawal.

Acceptance: Approved synthetic access succeeds before withdrawal; subsequent access is denied according to the selected policy. Retention behavior is explicit. Decision dependencies: D04, D07.

### FR26 Operational reports

Reports shall use defined claim statuses and versions, avoid double-counting corrections, and show period, filters, mode and last-updated timestamp.

Acceptance: Changing a submitted version does not create two claims in the claim count; proposed and approved corrections are separate. Decision dependencies: D03, D08.

### FR27 Loss ratio inputs

A loss ratio shall use approved aligned incurred-loss and earned-premium inputs, cohort, period and gross/net definition. Unknown or zero-denominator states shall be explicit.

Acceptance: No benefit-limit substitution; no made-up premium or reserve; no numerical ratio when input requirements are unmet. Decision dependencies: D08.

### FR28 Segmented reporting

Hospital, diagnosis and procedure views shall use an approved metric definition and expose input coverage.

Acceptance: A provider-cost chart is not labelled provider loss ratio unless an agreed premium-allocation method exists. Decision dependencies: D08.

### Finance demonstration input template

The agent pack contains finance_inputs.template.json. Period, cohort, earned premiums, incurred losses/reserve components, gross/net basis and source timestamps are deliberately null. D08 must supply them before the numerical loss-ratio demo is built. Synthetic approval is required for values as well as for the chosen formula.

### History fixture template

The agent pack contains history.template.json. Case 001 supplies only encounter context and service evidence. No allergies, clinical result, treatment outcome, date of birth or broad history is inferred. D07 selects the fields, recipients, purposes and synthetic record content.

### Interoperability boundary

Plan mappings to FHIR Coverage, Claim, ClaimResponse, ExplanationOfBenefit and PaymentReconciliation where appropriate. Actual FHIR version, profile and partner validation requirements remain OPEN in D10. Do not describe a local JSON endpoint as a certified national integration.

## Proposed API contract for parallel work

This endpoint catalogue is a proposal to freeze in D03. The shared OpenAPI contract is produced by task T03 after that decision. No runnable OpenAPI specification is supplied with invented enum values, sessions or partner contracts. Frontend and backend agents must use the same approved contract.

| Method | Proposed path | Business operation |
| --- | --- | --- |
| GET | /api/v1/claims | Filtered and paginated authorized queue. |
| POST | /api/v1/claims | Create draft with approved required identifiers. |
| GET | /api/v1/claims/{id} | Claim overview, current version and links. |
| PATCH | /api/v1/claims/{id}/draft | Edit permitted draft fields only. |
| POST | /api/v1/claims/{id}/submit | Preserve submitted version. |
| GET | /api/v1/claims/{id}/versions | Inspect original and corrected versions. |
| POST | /api/v1/claims/{id}/validate | Create a validation run for a specific version. |
| GET | /api/v1/claims/{id}/findings | Read findings and evidence references. |
| POST | /api/v1/claims/{id}/correction-requests | Request specified corrections or evidence. |
| POST | /api/v1/claims/{id}/corrections | Submit a linked corrected version. |
| POST | /api/v1/claims/{id}/decisions | Record finding-level review decisions. |
| POST | /api/v1/claims/{id}/approve | Approve exact version with financial effects. |
| GET | /api/v1/claims/{id}/settlement | Read approved or proposed financial state. |
| POST | /api/v1/payments | Record simulated payment and allocation. |
| POST | /api/v1/reconciliations | Match a receipt to allocation(s). |
| GET | /api/v1/claims/{id}/audit | Read authorized workflow and financial events. |
| GET | /api/v1/members/{id}/history | Purpose-checked access to permitted history. |
| POST | /api/v1/consent-grants | Record grant under selected actor and policy. |
| POST | /api/v1/consent-grants/{id}/withdraw | Record withdrawal and enforce future access. |
| GET | /api/v1/reports/operations | Defined operational measures. |
| GET | /api/v1/reports/loss-ratio | Approved financial inputs or unavailable state. |
| POST | /api/v1/documents | Upload permitted private evidence. |
| GET | /api/v1/documents/{id} | Authorized document access. |

Authentication routes, approved-rule configuration endpoints, import APIs and appeal/reversal actions depend on D03 D04 D06 D10. Agents must not invent these while implementing a listed endpoint.

## Interface security and operational acceptance

### Shared contract fields to freeze

T03 must define field types, required/nullable values, request and response schemas, error envelope, status codes, pagination/filter semantics, currency and money serialization, timestamps, idempotency-key placement, current-version checks and source-mode labels. Missing inputs must produce explicit validation or unavailable responses, not fabricated success payloads.

### NF01 Server enforced access

All APIs, lists, exports and document reads shall enforce the selected role and organization/purpose boundaries.

Acceptance: Cross-organization and revoked-grant API tests fail closed; role labels in the UI cannot bypass checks. Decision dependencies: D04.

### NF02 Secrets and data discipline

The build shall keep secrets outside source control and use synthetic fixtures only. Logs and error traces shall not expose documents, credentials or unnecessary clinical content.

Acceptance: Repository and logging review show no secrets or real patient data; deployment values are provided explicitly. Decision dependencies: D11.

### NF03 Audit and immutability

Published claim versions, assessments, decisions and financial entries shall remain attributable; correction is a new record.

Acceptance: Audit identifies actor/time/version/reason and no ordinary UI/API can silently rewrite submitted evidence. Decision dependencies: D03, D04.

### NF04 User states

Screens shall handle loading, empty results, unavailable inputs, invalid forms, permission denial, conflict and success without hiding failed operations.

Acceptance: A failed API request does not become a success toast or a fake local result. Decision dependencies: D03.

### NF05 Reproducible delivery

The repository shall document setup, migrations, approved fixtures, configuration, tests, reset/reseed procedure and known limitations.

Acceptance: Another team member can start the build and run the agreed acceptance commands without hidden local state. Decision dependencies: D03, D11.

### NF06 Performance and recovery

Agreed browser, viewport, load, response-time, backup and recovery targets shall be documented and tested at the chosen demonstration or pilot level.

Acceptance: D12 supplies targets; no invented latency, concurrency, uptime, RPO or RTO claim appears in the pitch. Decision dependencies: D12.

### Technical reference sources

FastAPI application modules: https://fastapi.tiangolo.com/tutorial/bigger-applications/
FastAPI security: https://fastapi.tiangolo.com/tutorial/security/
Next.js server and client components: https://nextjs.org/docs/app/getting-started/server-and-client-components
PostgreSQL locking: https://www.postgresql.org/docs/current/explicit-locking.html
FHIR financial module: https://hl7.org/fhir/R4/financial-module.html

## Acceptance catalogue and agent ambiguity rules

| Test | Requirement links | Scenario | Expected evidence |
| --- | --- | --- | --- |
| AT01 | FR05 FR12 FR13 FR17 | Case 001 | Six original lines; five flagged lines; correction 6400; eligible 29700; member 2970; insurer 26730. |
| AT02 | FR05 FR15 | Corrected submission | Original and revised evidence/version remain available; revalidation targets the corrected version. |
| AT03 | FR14 FR20 | Unresolved findings | Normal approval is rejected while required findings or correction evidence remain unresolved. |
| AT04 | FR11 FR20 | Stale run | Changing the submitted version makes the old assessment ineligible for approval. |
| AT05 | FR19 FR20 | Concurrent claims | Available benefit cannot be consumed twice; Case 001 posting leaves 55270. |
| AT06 | FR21 FR23 | Payment retry | Repeated source reference/idempotency key cannot create a second payment. |
| AT07 | FR22 | Receipt match | Exact insurer-share receipt yields variance zero; mismatched/partial receipt stays unresolved. |
| AT08 | FR03 FR18 | Unknown policy config | A different policy does not inherit the reference limit, 10% share or exclusion assumptions. |
| AT09 | FR24 FR25 NF01 | History access | Authorized synthetic grant permits selected scope; wrong recipient and withdrawn grant fail. |
| AT10 | FR27 FR28 | Finance inputs | No ratio with missing inputs or zero earned premium; approved synthetic inputs calculate reproducibly. |
| AT11 | FR16 | Repeat procedure | A legitimate repeat case is not automatically denied or labelled proven fraud. |
| AT12 | FR08 NF01 | Organization boundaries | Unauthorized users cannot list another organization claim or retrieve its document by ID. |
| AT13 | FR01 NF04 | Demo disclosure | Every mock and synthetic input is visible; API failure is not replaced by invented success. |
| AT14 | NF05 | Fresh setup | Approved migrations and seed/reset steps reproduce the reference case and agreed tests. |

Additional fixture amounts and dates for negative cases require D05 D06 D07 D08 D09 approval. The test intent is specified; unknown test data is not silently invented. A test needing a blocked fixture is marked BLOCKED, not passed.
