# Claimwise One Week Work Plan

Allocates the one week build, identifies dependencies and unresolved decisions, and provides explicit AI agent execution and handoff rules.

Version 0.1 | 9 October 2026 | One week demonstration

## Team allocation and daily outcomes

We have one week to deliver a full strategy demonstration using Next.js with TypeScript, FastAPI and PostgreSQL. Ingrid and Lameck own frontend work. Tristan/Brian is one backend contributor alongside Obunde. Silas owns documentation, presentation and coordination of supporting evidence. Calendar dates, daily capacity and final acceptance authority remain OPEN in D01 D12.

| Owner | Primary allocation | Review and handoff |
| --- | --- | --- |
| Ingrid | Intake/detail/auth evidence, provider correction, consent/history, selected extraction/channel UI. | Review Lameck frontend changes; own UI states on her flows. |
| Lameck | Next.js shell/client, queue, findings/review, settlement and reporting. | Review Ingrid frontend changes; integrate frontend contract. |
| Tristan/Brian | Data model, API contract, reference policy/contracts, claims/rules/corrections, selected anomaly/adapters. | Review Obunde backend changes; no financial-policy invention. |
| Obunde | Environment/migrations, access, consent/history API, financial ledger/payment, reporting and deployment. | Review Tristan/Brian backend changes; enforce access and financial invariants. |
| Silas | Decision register, BRD/SRS, approved fixture coordination, acceptance index, demo script and presentation. | Record team choices; coordinate reviews. Does not certify clinical correctness or legal compliance. |

| Day | Proposed outcome and dependency |
| --- | --- |
| Day 1 | Resolve critical choices; agree capacity, data and API schema; publish ERD/contract draft and five-part storyboard. |
| Day 2 | Approved setup, access, migrations and Case 001 seed; frontend shell and intake/queue consume the shared contract. |
| Day 3 | Claim versions, reference checks and correction path integrated; history/consent backend and UI develop against approved policy. |
| Day 4 | Reviewer approval and settlement integrated; selected history, reports and adapters reach a demonstrable thin slice. |
| Day 5 | All five strategy parts integrated or explicitly blocked; complete chosen demo modes; run end-to-end tests. |
| Day 6 | Fix financial/access/integration defects; verify deployment and reset/reseed; collect evidence and rehearse. |
| Day 7 | Final acceptance by the chosen owner, presentation rehearsal and delivery; record remaining limitations. |

This is a proposed sequence, not a capacity estimate. If a dependent decision is unanswered or effort exceeds available time, ask the team to select scope/depth tradeoffs in D02. Do not silently turn a required strategy part into an unlabelled mock or drop it.

## Frontend work assignments

| Task and owner | Work and target | Dependencies and evidence |
| --- | --- | --- |
| T05 Lameck | Set up Next.js shell and shared API client<br>D1, D2 | Tasks: none<br>Decisions: D03, D11<br>Existing five-screen navigation represented in Next.js; approved client/error contracts; feature disclosure. |
| T09 Ingrid | Build intake claim detail and authorization views<br>D2, D3 | Tasks: T05, T03<br>Decisions: D02, D04, D05, D10<br>Forms use approved required fields; errors shown; original bill/auth evidence visible; optional creation follows D02. |
| T10 Lameck | Build dashboard queue and claim navigation<br>D2, D3 | Tasks: T05, T03<br>Decisions: D03, D08<br>Real API list/filter states; no frontend fabricated totals; reference claim opens. |
| T12 Lameck | Build validation and reviewer workbench<br>D3, D4 | Tasks: T05, T03, T11<br>Decisions: D04, D06, D09<br>Evidence and rule explanations; decisions/reasons; blocked approval and stale-run messages. |
| T14 Ingrid | Build provider correction submission and response views<br>D3, D4 | Tasks: T09, T13<br>Decisions: D04, D05<br>Provider can view requested lines/evidence and resubmit; original remains available. |
| T16 Lameck | Build settlement payment and reconciliation views<br>D4, D5 | Tasks: T05, T03, T15<br>Decisions: D06<br>API-backed amounts; payment simulation label; receipt match and variance; repeated actions safe. |
| T18 Ingrid | Build patient consent and scoped history views<br>D3, D4 | Tasks: T05, T03, T17<br>Decisions: D04, D07<br>Member action, purpose/recipient/scope and withdrawal shown; wrong recipient denied; synthetic contents approved. |
| T20 Lameck | Build operational and loss ratio reporting views<br>D4, D5 | Tasks: T05, T19<br>Decisions: D08<br>Inputs/period/cohort/update time visible; unavailable state; segments use approved metric labels. |
| T22 Ingrid | Integrate agreed extraction and channel or identity screens<br>D4, D5 | Tasks: T09, T21<br>Decisions: D02, D10<br>Human verification where selected; integration mode truthful; absent features labelled unavailable. |
| T26 Ingrid | Verify frontend flows responsive states and accessibility<br>D5, D6 | Tasks: T09, T14, T18, T22<br>Decisions: D12<br>Form, denied-access, loading/conflict and agreed viewport evidence; issues filed with owners. |
| T27 Lameck | Run integrated end to end reviewer and reporting tests<br>D5, D6 | Tasks: T10, T12, T16, T20<br>Decisions: D08, D12<br>Reference path and reporting/history linkage tests; actual result evidence, no manual success substitution. |

The frontend must consume approved API values and error states. A frontend agent may use approved contract mocks for isolated UI work, but each mock is labelled and must not silently remain in the integrated demonstration. Finance/history placeholders are not permission to create numbers or records.

## Backend work assignments

| Task and owner | Work and target | Dependencies and evidence |
| --- | --- | --- |
| T02 Tristan/Brian | Prepare ERD workflow and reference rules<br>D1 | Tasks: none<br>Decisions: D03, D05, D06<br>Reviewed schema/state transitions; Case 001 mapping; decisions linked. |
| T03 Tristan/Brian | Freeze shared API contract with frontend owners<br>D1, D2 | Tasks: T02<br>Decisions: D03, D04, D05, D06, D07, D08<br>Versioned OpenAPI; examples only from approved fixtures; error/nullable/idempotency semantics. |
| T04 Obunde | Set up backend database migrations and environment<br>D1, D2 | Tasks: none<br>Decisions: D03, D11<br>FastAPI health route; PostgreSQL connection; first migration; secret-free setup instructions. |
| T06 Obunde | Implement agreed authentication and access checks<br>D2 | Tasks: T04<br>Decisions: D04<br>Tested users/organization delegation; no role-picker bypass; list and document access controls. |
| T07 Tristan/Brian | Implement policy contract authorization and Case 001 seed<br>D2 | Tasks: T04, T02<br>Decisions: D03, D05<br>Versioned reference records reproduce known fixture; missing attributes stay unset. |
| T08 Tristan/Brian | Implement claim drafts versions submission and evidence links<br>D2, D3 | Tasks: T03, T06, T07<br>Decisions: D05, D10<br>Draft/submission APIs; immutable originals; approved uploads/storage; ownership checks. |
| T11 Tristan/Brian | Implement versioned rule assessment<br>D3 | Tasks: T07, T08<br>Decisions: D03, D06, D09<br>Case 001 five findings; overlap resolution; immutable validation runs; chosen anomaly mode disclosed. |
| T13 Tristan/Brian | Implement correction requests provider responses and adjudication<br>D3, D4 | Tasks: T08, T11<br>Decisions: D04, D05, D06<br>Corrected version revalidated; disputes recorded; approval binds exact version and evidence. |
| T15 Obunde | Implement settlement benefit ledger and payment reconciliation<br>D3, D4 | Tasks: T06, T07, T13<br>Decisions: D03, D06<br>Exact reference shares; concurrency/idempotency tests; simulated payment; mismatch not closed. |
| T17 Obunde | Implement consent grants withdrawal and history access<br>D3, D4 | Tasks: T06, T03<br>Decisions: D07<br>Approved history fixtures and purposes; grant/recipient checks; withdrawal enforced server-side. |
| T19 Obunde | Implement reporting inputs and operation or loss ratio APIs<br>D4, D5 | Tasks: T04, T03, T07<br>Decisions: D08<br>Approved synthetic cohort values; correct definition; missing/zero input states; no duplicate claims. |
| T21 Tristan/Brian | Implement agreed OCR anomaly or external demo adapters<br>D4, D5 | Tasks: T08, T11<br>Decisions: D02, D09, D10<br>Only selected modes built; mock provenance visible; unknown access or thresholds remain blocked. |

Both backend owners use the same approved models and migration history. Agree ownership of shared schema files before concurrent agent work. API responses are validated against T03; domain actions preserve versions and do not accept arbitrary client-provided totals or status.

## Documentation verification and delivery assignments

| Task and owner | Work and target | Dependencies and evidence |
| --- | --- | --- |
| T01 Silas | Confirm week calendar scope and acceptance<br>D1 | Tasks: none<br>Decisions: D01, D02, D12<br>Record exact answers and all five capability modes; keep unresolved items OPEN. |
| T23 Silas | Maintain BRD SRS decision register and change log<br>D1, D2, D3, D4, D5, D6, D7 | Tasks: none<br>Decisions: none<br>Current decisions/requirements/task links; exact approvals; no agent recommendation promoted automatically. |
| T24 Silas | Collect approved synthetic finance history and negative fixtures<br>D1, D2 | Tasks: none<br>Decisions: D05, D06, D07, D08, D09<br>Team-approved values/provenance recorded; unknown templates remain null until resolved. |
| T25 Obunde | Prepare CI configuration and demonstration deployment<br>D2, D5, D6 | Tasks: T04, T05<br>Decisions: D03, D11, D12<br>Approved checks/migrations/setup; no credentials committed; intended audience and chosen hosting verified. |
| T28 Tristan/Brian | Verify rules versions corrections and fixtures<br>D5, D6 | Tasks: T11, T13, T21, T24<br>Decisions: D05, D06, D09<br>AT01 AT02 AT03 AT04 AT08 AT11 evidence; blocked fixtures reported honestly. |
| T29 Obunde | Verify access concurrency payments history and finance<br>D5, D6 | Tasks: T15, T17, T19, T24<br>Decisions: D04, D06, D07, D08<br>AT05 AT06 AT07 AT09 AT10 AT12 evidence; fresh database migration check. |
| T30 Silas | Prepare demo script presentation and limitation statements<br>D2, D5, D6, D7 | Tasks: T01<br>Decisions: D02, D12<br>Five-dimension storyboard, demo/pitch script, synthetic/mock disclosures, source-backed market statements. |
| T31 Silas | Index acceptance evidence and coordinate rehearsal<br>D6, D7 | Tasks: T26, T27, T28, T29, T30<br>Decisions: D12<br>Evidence index mapped to AT01 through AT14; unresolved gaps and rehearsal failures assigned. |

### T32 Team: final acceptance and handoff

Day 7. Depends on T25 and T31; decisions D02, D11 and D12. The team-named acceptance owner records passed and blocked items. Deliver the reproducible build, presentation script and known limitations.

### Recommended review rhythm

At the start of each day, owners state completed work, next task and unresolved decision. At day end, show the current integrated path and record evidence or blockers. Meeting times and lengths are for the team to choose. Silas updates documentation and the demo capability matrix from the actual build, not intended features.

Review allocation is part of this proposed plan. Business decisions are confirmed by the team; proposed coordinators gather answers and keep records. No contributor name is silently substituted for another, and Tristan/Brian is not split into two owners.

## Decision bookmarks for Day 1

### D01 Calendar and capacity

OPEN. Revisit: Before Day 1 scheduling. Proposed coordinators: Team; Silas records.

Question: Which calendar dates define the week, what is the presentation deadline, and what hours can each person commit?

Blocks: Daily schedule and effort commitments. Use Day 1 to Day 7 only; do not invent dates or hours.

### D02 Demonstration boundaries

OPEN. Revisit: Day 1 before feature promises. Proposed coordinators: Team; Silas records.

Question: For each strategy part, approve the working feature, synthetic input and explicitly mocked integration. Must OCR, biometrics, USSD, WhatsApp, preauthorization creation and anomaly scoring work this week?

Blocks: Scope commitments and deferred features. Five dimensions remain required. Do not silently omit a dimension or call a mock live.

### D03 Technical conventions and API freeze

OPEN. Revisit: Day 1 before shared implementation. Proposed coordinators: Tristan/Brian and Obunde with frontend owners.

Question: Approve modular FastAPI architecture, ORM and migrations, package versions, API paths, response schemas, money representation and repository layout. Is the proposed SRS contract accepted or amended?

Blocks: Shared schema, framework setup, clients and implementation contract. Next.js, TypeScript, FastAPI and PostgreSQL are confirmed; other libraries and protocol details are proposed.

### D04 Identity and access

OPEN. Revisit: Before auth or protected history. Proposed coordinators: Obunde with team.

Question: Choose authentication and session handling. Confirm users and roles, insurer/provider/TPA boundaries, who can approve claims, who can grant consent, and whether approval separation is required.

Blocks: Login, authorization, API data filtering and consent ownership. A role picker is not authentication. Do not issue insecure demo bypasses as live access control.

To resolve a bookmark, replace OPEN with CONFIRMED only after recording the exact answer, answering person, date and affected task/requirement IDs. A recommendation or a default selection suggested by an agent is not an answer.

## Decision bookmarks for financial and clinical behavior

### D05 Data schema and fixture extension

OPEN. Revisit: Before intake and new fixtures. Proposed coordinators: Tristan/Brian with Silas.

Question: Approve required member, claim, policy and service fields; coding systems and provider code mapping; date rules; permitted additional fictional cases and their values.

Blocks: Claim forms, validation and nonreference fixtures. Only Case 001 values are supplied. Missing birth dates, emails, premiums, diagnoses and addresses remain unset.

### D06 Financial policy and exceptions

OPEN. Revisit: Before general settlement rules. Proposed coordinators: Tristan/Brian and Obunde with team.

Question: Outside Case 001, confirm deductible and coinsurance order, benefit consumption basis, reservation timing, exclusions, rounding, partial approval, reversals and who absorbs each adjustment.

Blocks: General calculations, benefit ledger and exception workflow. Case 001 uses 10% member share and insurer-share benefit consumption. Never apply it universally.

### D07 Clinical history and consent

OPEN. Revisit: Before sharing implementation. Proposed coordinators: Ingrid and Obunde with team.

Question: Approve history fields, allowed recipients and purposes, how patient action is established, grant expiry, withdrawal behavior and permitted retained records. May underwriting history sharing work in this demo or be a labelled illustration?

Blocks: History fixtures, consent UI and authorization checks. Claims access does not grant underwriting access. No new patient facts or consent grants are invented.

### D08 Report definitions and finance inputs

OPEN. Revisit: Before loss ratio is displayed. Proposed coordinators: Obunde and Lameck with Silas.

Question: Supply approved synthetic earned premiums, incurred claims or reserve inputs, period, scheme, gross/net basis and timestamps. Approve whether loss ratio by hospital/diagnosis/procedure is valid or whether those views show claim costs only.

Blocks: Financial fixture, loss ratio and segmented reporting. Unknown values are null and the metric is unavailable. A benefit limit is not earned premium.

### D09 Anomaly and AI scope

OPEN. Revisit: Before any AI or anomaly label. Proposed coordinators: Tristan/Brian with team.

Question: Select a demonstration method: explained heuristic flags, a clearly mocked model response, or a model with approved data and evaluation. Approve features, thresholds and labels. How is a legitimate repeat procedure distinguished?

Blocks: Anomaly service, evaluation and pitch claims. The strategy mentions a 30-day cross-provider signal, not a fraud verdict or approval to implement a model.

## Decision bookmarks for integrations and delivery

### D10 Document handling and external adapters

OPEN. Revisit: Before uploads or integrations. Proposed coordinators: Backend owners with Ingrid.

Question: Choose private storage and document limits. Confirm OCR mode and permitted document fixtures. Supply authorized API contracts and credentials for any real integration; otherwise agree mock disclosures.

Blocks: Upload handlers, OCR, SHA/DHA, biometrics, WhatsApp and USSD. Do not invent national IDs, endpoints, biometric records, credentials or upload limits.

### D11 Hosting and delivery

OPEN. Revisit: Before deployment. Proposed coordinators: Obunde with team.

Question: Where will frontend, API, database and documents run? Confirm repository access, environments, secrets, audience, hostname and who can publish. Does Kenya hosting apply to the synthetic demo environment or only the real-data pilot?

Blocks: Deployment, CORS, DNS, CI and network access. Prepare environment examples with placeholders; do not choose a paid provider or publish real data.

### D12 Acceptance and presentation

OPEN. Revisit: Day 1 and before Day 7 delivery. Proposed coordinators: Team with Silas.

Question: Who signs off the demonstration? What is the pitch duration, audience and required format? Confirm browsers, viewport needs, load and response-time targets and minimum evidence for all five dimensions.

Blocks: Final acceptance, performance thresholds and pitch length. No invented numerical benchmarks or presentation length.

### D13 Business and pilot agreements

OPEN. Revisit: Before a pilot offer. Proposed coordinators: Team; Silas coordinates.

Question: Confirm target buyer, pilot partner, provider participation, pricing, savings baseline, attribution and dispute ownership.

Blocks: Commercial claims and pilot proposal. The week delivers a demonstration, not a signed pilot, market validation or measured savings.

### D14 Real data governance

OPEN. Revisit: Before any real-data processing. Proposed coordinators: Team with qualified legal and domain advisers; Silas records.

Question: Confirm controller/processor roles, lawful bases and confidentiality obligations, retention and transfer rules, ODPC steps, DHA classification/certification and insurer-specific requirements.

Blocks: Any real data, real identity integration or production deployment. Synthetic-only policy remains active. Do not claim legal compliance, certification or regulator approval.

## AI agent execution and final handoff

### Before implementation

Read README.md, BRD.md, SRS.md, WORK_PLAN.md, decisions.json, requirements.json, backlog.json and the relevant fixture. Identify one assigned task and its owner. Check every requirement and decision dependency. A prerequisite task must be DONE with evidence; an OPEN decision blocks dependent behavior. Continue only independent work that does not require the unanswered choice.

### Ask instead of assuming

Use this question: Task [ID] / requirement [ID] is blocked by decision [ID]. We need [exact choice or value]. It affects [behavior]. Options are [brief options]; recommendation [reason], if useful. I can continue [independent work]. Please choose or supply the value. Record the explicit response before implementation. Do not treat elapsed time or no answer as approval.

### Task handoff template

Task ID and owner; requirement IDs; decision statuses and exact approved answers; relevant files; API contract version; permitted edits; acceptance tests; mock/synthetic boundaries; commands run and results; remaining blockers; reviewer. A completed handoff references actual evidence, not a claim that a test ought to pass.

### Working boundaries

Agents must not invent business rules, amounts, clinical facts, premiums, identities, API credentials, approvals, legal conclusions, trained-model results or claimed savings. Never replace an unavailable service with a fabricated success response. Mark mocks clearly, keep original records and refuse unsupported state changes. Propose new fixtures first; do not make them look like supplied facts.

### Definition of done

A task is DONE when its decisions are resolved, prerequisites are complete, implementation and appropriate tests meet its acceptance criteria, the reviewer has checked the changes, and evidence plus limitations are recorded. A blocked task is BLOCKED. An optional feature omitted by team decision is DEFERRED with that decision reference. A mock is completed mock behavior, not completed integration.

### Presentation and release evidence

Silas maintains the demo capability matrix, acceptance results, exact build/revision identifier, setup/reset steps, source references and presentation claims. Final rehearsal covers all five dimensions. The handoff lists unresolved decisions, missing data, unimplemented features and actual versus mocked behavior. Pilot agreements, real patient data, payments, certification and market-validation claims stay outside the week unless separately authorized and satisfied.

### Starting work safely

Immediately available work includes source review, reference arithmetic checks, requirements and decision indexing, preparing questions, inspecting the existing prototype and drafting the five-part storyboard. Framework/schema/auth/finance/history implementation follows its relevant decisions. The agent pack supplies no application code and makes no deployment changes.
