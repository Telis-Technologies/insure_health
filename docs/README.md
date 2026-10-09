# Claimwise one week build package

Start with AGENTS.md and confirmed_baseline.json. Human-readable BRD.md, SRS.md and WORK_PLAN.md match the editable documents. Requirements, tasks, acceptance tests and decision dependencies are also JSON for agent use. This package supplies no application code or credentials and does not modify the existing prototype.

## Confirmed choices
One week. Full strategy demonstration. Next.js + TypeScript, FastAPI and PostgreSQL. Frontend Ingrid/Lameck; backend Tristan/Brian (one contributor)/Obunde; Silas documentation/presentation. Synthetic data until an agreed real-data pilot and review.

## Required first action
Resolve Day 1 decision bookmarks before dependent implementation. D01 calendar/capacity, D02 demo modes, D03 shared conventions/contract, D04 access, D05 schema/fixtures, D06 finance, D07 history, D08 reporting inputs and D12 acceptance require explicit answers. D09-D11 govern selected advanced features/integrations/deployment; D13-D14 govern pilot commitments and real data. Do not invent answers.

## Files
- BRD.md: business scope and reference case.
- SRS.md: software requirements and proposed API catalogue.
- WORK_PLAN.md: named tasks, seven-day sequence and bookmarks.
- confirmed_baseline.json: explicitly confirmed facts.
- decisions.json and DECISION_LOG.md: OPEN questions and future exact answers.
- requirements.json, backlog.json, acceptance_tests.json: traceable agent tasks; no tests yet run.
- reference_case_001.json: known fictional case values; unknown member fields are null.
- finance_inputs.template.json and history.template.json: deliberately blocked input templates.
- task_handoff.template.md: prompt for a bounded coding task.

Important: Day 1-Day 7 are relative labels, not confirmed calendar dates. Proposed reviewers and technical details are reviewable assignments/specifications, not invented prior agreements. This package does not create a new patient, tariff or financial fixture beyond supplied Case 001.
