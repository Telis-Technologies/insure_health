# Claimwise Business Requirements

Defines the one week business outcome, stakeholder value, scope, business rules and unresolved business decisions.

Version 0.1 | 9 October 2026 | One week demonstration

## Business baseline and delivery outcome

We will build a full strategy demonstration in one week. It must show all five strategy parts using synthetic data: digital claims and preauthorization, claim checks, consented patient history, reporting, and settlement with reconciliation. The demonstration must state which capabilities are working and which integrations or outputs are simulated.

This BRD is version 0.1, dated 9 October 2026. Confirmed instructions and reference facts are distinguished from proposed implementation details. OPEN decision bookmarks prohibit agents from filling gaps with unapproved values. The previous two week sprint and fourteen week delivery plan are superseded for this immediate build; later pilot planning remains separate.

| Confirmed item | Baseline |
| --- | --- |
| Duration | One week |
| Outcome | Full strategy demonstration |
| Stack | Next.js with TypeScript, FastAPI and PostgreSQL |
| Frontend | Ingrid and Lameck |
| Backend | Tristan/Brian and Obunde; Tristan/Brian is one person or alias |
| Documentation | Silas handles documentation, presentation and other supporting tasks |
| Data | Synthetic data until a pilot agreement and data protection review exist |
| Claim fixture | Reference Case 001 and its amounts are fictional demonstration facts |

### Business objectives

BR01 The demonstration shall cover all five parts in the final strategy. Acceptance: Every part has an observable walkthrough and an honest capability label.

BR02 A reviewer shall trace a finding from a submitted bill line to a contract or authorization rule, evidence, decision and settlement. Acceptance: Case 001 shows its five flagged lines and KES 6,400 correction without duplicate deductions.

BR03 The workflow shall show insurer or TPA review, provider correction, and patient control of history sharing. Acceptance: The walkthrough identifies each actor and the action recorded for that actor.

BR04 The pitch shall distinguish synthetic calculations, suspected discrepancies and measured real outcomes. Acceptance: No invented customer, fraud detection rate, savings, loss ratio or regulator endorsement is presented.

BR05 The team shall have traceable requirements, tasks, decisions and acceptance evidence. Acceptance: An agent can identify its task, dependency, unresolved question and completion test.

## Capability coverage and business boundaries

The following minimum demonstration slices are proposed for Day 1 scope confirmation in D02. Full strategy demonstration is confirmed; exact implementation depth is not. Agents must obtain a recorded choice for optional or mocked features before building or excluding them.

| Strategy part | Proposed working slice | Items requiring a decision |
| --- | --- | --- |
| Digital forms | Structured claim intake, attachments and authorization evidence linked to an encounter. | Creating a preauthorization request; OCR; biometric sign-off; USSD and WhatsApp. D02 D10 |
| Claim checks | Explainable reference-case checks, human review and correction loop. | Additional rule semantics; anomaly/AI implementation, input features and thresholds. D05 D06 D09 |
| Patient history | Synthetic record sharing with explicit purpose, recipient, grant and withdrawal flow. | Content and recipients; authenticated patient action; underwriting versus care purposes. D04 D07 |
| Reporting | Operational claim metrics and a loss-ratio view using approved synthetic finance data. | Premiums, reserve inputs, period and segmentation definitions. D08 |
| Settlement | Approved member and insurer shares, simulated payment, receipt matching and audit history. | General financial rules, partial payments, reversals and benefit reservation timing. D06 |

### Scope control

Synthetic-only and simulated-payment boundaries remain in force. The week does not promise live insurer or SHA connectivity, production biometrics, medical diagnosis, autonomous denial, a trained fraud model, a signed pilot or measured savings. An OPEN decision can add an explicitly agreed demo feature; it cannot quietly expand the system into real-data processing.

Every capability shall use one of these evidence labels: WORKING for implemented behavior tested in the delivered build; SYNTHETIC INPUT for fictional source data; MOCKED INTEGRATION for a stand-in external response; NOT IMPLEMENTED for unavailable behavior. A working calculation may still use synthetic input. Each label has a distinct meaning.

### Business stakeholders and operating roles

| Stakeholder | Business responsibility |
| --- | --- |
| Insurer buyer | Funds the product or pilot and validates financial/reporting definitions. Actual organization remains OPEN in D13. |
| Insurer or TPA reviewer | Assesses findings, records decisions and recommends or approves according to the agreed role model. |
| Provider billing team | Submits a bill, supplies evidence, corrects or disputes charges and acknowledges payment. |
| Patient or member | Controls applicable history-sharing actions and receives clear member responsibility information. |
| Team and Silas | Deliver the demo; maintain evidence, unresolved decisions and presentation statements. |

## Reference business case and accounting boundaries

Reference Case 001 is fictional. Member Daniel Mwangi holds POL-2026-001 with Harbor Health Assurance. Riverside Medical Centre participates under CON-2026-017; MediBridge Administrators is the TPA. Outpatient limit is KES 100,000, earlier use KES 18,000, and available benefit before this claim KES 82,000. Member coinsurance is 10% of eligible charges for this fixture only.

Service date is 22 September 2026. Context is persistent headaches with new neurological symptoms. AUTH-001 approves MRI brain without contrast for that date with a KES 25,000 ceiling. Do not invent clinical outcomes or additional patient attributes.

| Bill line | Billed KES | Correction KES | Eligible KES |
| --- | --- | --- | --- |
| L01 Consultation | 2,500 | 500 | 2,000 |
| L02 CBC | 1,800 | 300 | 1,500 |
| L03 MRI without contrast | 28,000 | 3,000 | 25,000 |
| L04 Medication | 1,200 | 0 | 1,200 |
| L05 Duplicate CBC | 1,800 | 1,800 | 0 |
| L06 Administration fee | 800 | 800 | 0 |
| Total | 36,100 | 6,400 | 29,700 |

The MRI tariff and authorization findings overlap: their combined correction is KES 3,000, not KES 6,000. The duplicate CBC is removed entirely without another tariff deduction. All corrections are absorbed by the provider in this reference contract. These terms cannot be applied to another insurer or provider without an agreed rule.

| Settlement measure | Expected value |
| --- | --- |
| Eligible cost | KES 29,700 |
| Member share | KES 2,970 |
| Insurer share | KES 26,730 |
| Remaining benefit after posting insurer share | KES 55,270 |
| Reconciliation variance after exact payment match | KES 0 |

Timeline: care 22 Sep; submission and validation 23 Sep; provider correction 24 Sep; adjudication 25 Sep; simulated payment and reconciliation 2 Oct 2026. These are fixture dates, not the one week project calendar.

A bill correction is not automatically insurer savings or proven fraud. Benefit limit is not premium. Loss ratio requires a defined cohort and period, earned-premium inputs and incurred-loss information; segmented claim costs do not automatically establish segmented loss ratios.

## Business acceptance and decisions to revisit

### Demonstration acceptance

The demonstration is ready when all five dimensions have approved walkthroughs, Case 001 reproduces the stated amounts, the application retains submitted and corrected versions, protected history follows the selected consent policy, reporting shows its inputs and dates, and a simulated payment reconciles with evidence. D02 and D12 determine the final scope and acceptance owner.

| Metric | Evidence this week | What must not be inferred |
| --- | --- | --- |
| Coverage | One observable path for each strategy part. | Working national integrations or production readiness. |
| Traceability | Findings and decisions link to source evidence and versions. | Proven fraud or correctness of unreviewed clinical conclusions. |
| Finance | Reference arithmetic and approved synthetic report calculations. | Real loss-ratio improvement or customer savings. |
| Patient protection | Grant, allowed access, withdrawal and denial tests on approved synthetic history. | Legal approval of broad underwriting access. |
| Delivery | Test evidence, known limitations and reproducible setup. | A signed pilot or validated market demand. |

### Priority business questions

Day 1: resolve D01 calendar and capacity, D02 feature boundaries, D07 history-sharing scope, D08 finance inputs and D12 acceptance. Before a real pilot: resolve D13 buyer/pricing/agreements and D14 data governance. The complete bookmarked decision register appears in the work plan and decisions.json.

### Main delivery risks

Full strategy breadth creates integration risk within one week. Demonstrate an agreed thin slice of each part; record optional features separately and ask the team which tradeoff to make if capacity is exceeded. Missing premiums block a numerical loss ratio. Missing identity decisions block protected history. Missing partner API access requires a disclosed mock, not a fabricated endpoint.

### Change and decision control

Silas maintains the decision register and evidence index; the team owns business choices. Each confirmed decision records the exact answer, the person who answered, the date and affected requirements/tasks. An agent recommendation remains PROPOSED until a team member resolves it. Absence of a reply never means approval.

### Reference material

Primary project source: Health Insurance Venture Project Strategy.pdf supplied on 9 October 2026. Superseding instructions: one week; full strategy demonstration; named role allocation; Tristan/Brian is one contributor; Next.js with TypeScript, FastAPI and PostgreSQL; agents must ask about unresolved decisions. Existing prototype: https://claimwise-reference-case.lamiruh.chatgpt.site
