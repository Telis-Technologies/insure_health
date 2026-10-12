"use client";

import Link from "next/link";
import { AccessManagement } from "@/components/access-management";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { case001, demoAuthorizations, demoMembers, demoPolicies, demoProviders, demoTenant, kes, referenceCases, ruleBasis } from "@/lib/demo-data";
import { ClaimIntake } from "@/components/claims/claim-intake";
import { ClaimDetail } from "@/components/claims/claim-detail";
import { AuthorizationNew } from "@/components/authorizations/authorization-new";

const pageNames: Record<string, string> = {
  claims: "Claims", members: "Members", policies: "Policies & benefits", providers: "Provider network",
  authorizations: "Authorizations", rules: "Policy & rules", reviews: "Claim review",
  settlements: "Settlements", reports: "Operational reports", audit: "Audit history", access: "Access & roles",
};

export function WorkspacePage({ slug }: { slug: string[] }) {
  const section = slug[0] ?? "claims";
  const title = pageNames[section] ?? "Health claims";

  if (section === "claims" && slug[1] === "new") return <ClaimIntake />;
  if (section === "claims" && slug.length > 1) return <ClaimDetail id={slug[1]} />;
  if (section === "claims") return <ClaimsList />;
  if (section === "members") return <Members />;
  if (section === "policies") return <Policies />;
  if (section === "providers") return <Providers />;
  if (section === "authorizations" && slug[1] === "new") return <AuthorizationNew />;
  if (section === "authorizations") return <Authorizations />;
  if (section === "rules") return <Rules />;
  if (section === "reviews") return <Reviews />;
  if (section === "settlements") return <Settlements />;
  if (section === "reports") return <Reports />;
  if (section === "audit") return <Audit />;
  if (section === "access") return <AccessManagement />;
  return <EmptySection title={title} />;
}

function Heading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function PreviewNote({ children }: { children: React.ReactNode }) {
  return <div className="preview-note"><span className="preview-note-icon">i</span><span>{children}</span><strong>PREVIEW</strong></div>;
}
function Panel({ title, kicker, children, extra }: { title: string; kicker?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return <section className="panel"><div className="panel-header"><div>{kicker ? <p className="panel-kicker">{kicker}</p> : null}<h2>{title}</h2></div>{extra}</div>{children}</section>;
}
function DisabledAction({ children }: { children: React.ReactNode }) { return <button className="button button-muted" type="button" onClick={() => window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: `${String(children).trim()} is not connected yet. No changes were saved.` }))} title="Preview action: backend API is not connected">{children}</button>; }
function RecordCard({ label, title, subtitle, rows }: { label: string; title: string; subtitle: string; rows: [string, string][] }) {
  return <section className="record-card"><p className="record-card-label">{label}</p><h2>{title}</h2><p className="record-card-subtitle">{subtitle}</p>{rows.map(([key, value]) => <div className="record-row" key={key}><span>{key}</span><strong>{value}</strong></div>)}</section>;
}

function ClaimsList() {
  const { data: session } = useSession();
  const isSuper = session?.user?.roles?.includes("platform-admin");
  const isProvider = session?.user?.roles?.includes("provider-biller");
  const providerIds = session?.user?.organizationIds ?? [];
  const visibleCases = isProvider && !isSuper ? referenceCases.filter((claim) => demoProviders.some((provider) => provider.name === claim.provider && providerIds.includes(provider.id))) : referenceCases;
  return <>
    <Heading eyebrow="WORKSPACE / CLAIMS" title="Claims" subtitle="Submitted health claims, their current review state and supporting evidence." action={isProvider || isSuper ? <Link className="button button-primary" href="/claims/new">＋ New claim</Link> : undefined} />
    <Panel title="Claim register" kicker={`${visibleCases.length} REFERENCE CASES`}>
      <div className="table-scroll"><table><thead><tr><th>Claim</th><th>Member / policy</th><th>Provider</th><th>Service date</th><th>Billed</th><th>Status</th></tr></thead>
        <tbody>{visibleCases.map((claim) => <tr key={claim.fixtureId}><td><Link className="table-primary-link" href={`/claims/${claim.fixtureId.toLowerCase()}`}>Case {claim.fixtureId.slice(-3)} <span>↗</span></Link><small className="table-sub">{claim.workflow}</small></td><td>{claim.member}<small className="table-sub">{claim.policy}</small></td><td>{claim.provider}</td><td>{claim.serviceDate}</td><td className="money-cell">{kes(claim.billed)}</td><td><span className="status-pill status-reference">{claim.status}</span></td></tr>)}</tbody>
      </table></div>
    </Panel>
  </>;
}

function Context({ label, value }: { label: string; value: string }) { return <div className="context-item"><span>{label}</span><strong>{value}</strong></div>; }

function Members() {
  return <><Heading eyebrow="HEALTH RECORDS / MEMBERS" title="Members" subtitle="Insured members and their policy relationships, scoped to the authorized organization." />
    <Panel title="Member directory" kicker={`${demoMembers.length} MEMBERS`}><div className="table-scroll"><table><thead><tr><th>Member reference</th><th>Policy</th><th>Insurer</th><th>Status</th></tr></thead><tbody>{demoMembers.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small className="table-sub">{member.id}</small></td><td>{member.policyName}<small className="table-sub">{member.policyId}</small></td><td>{member.insurer}</td><td>{member.status}</td></tr>)}</tbody></table></div></Panel>
  </>;
}

function Policies() {
  return <><Heading eyebrow="HEALTH RECORDS / COVERAGE" title="Policies & benefits" subtitle="Coverage terms and benefit balances selected for the member and service date." />
    <div className="record-cards">{demoPolicies.map((policy) => <RecordCard key={policy.id} label={`POLICY · ${policy.type.toUpperCase()}`} title={policy.name} subtitle={`${demoTenant} · ${policy.id}`} rows={[["Benefit type", policy.type], ["Illustrative annual limit", kes(policy.limit)], ["Effective period / version", "Not supplied"], ["Member enrollment", `${demoMembers.filter((member) => member.policyId === policy.id).length} members`], ["Rule source", "No insurer rule version attached"]]} />)}<RecordCard label="MEMBER BENEFIT" title="Reference calculation" subtitle="Case 001 · local values" rows={[["Eligible cost", kes(case001.eligible)], ["Member share", kes(case001.memberShare)], ["Insurer share", kes(case001.insurerShare)], ["Remaining benefit", kes(case001.remainingBenefit)], ["Benefit consumption basis", "Insurer share · reference only"]]} /></div>
  </>;
}

function Providers() {
  return <><Heading eyebrow="HEALTH RECORDS / NETWORK" title="Provider network" subtitle="Insurer-provider agreements, participating facilities and versioned service tariffs." />
    <Panel title="Contracted provider facilities" kicker={`${demoProviders.length} PROVIDERS`}><div className="table-scroll"><table><thead><tr><th>Facility</th><th>County</th><th>Contract</th><th>Insurer</th><th>Status</th></tr></thead><tbody>{demoProviders.map((provider) => <tr key={provider.id}><td><strong>{provider.name}</strong><small className="table-sub">{provider.id}</small></td><td>{provider.county}</td><td>{provider.contractId}</td><td>{provider.insurer}</td><td>{provider.status}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Tariff versions" kicker="SERVICE RATE CATALOGUE"><div className="empty-state-inline"><span>≋</span><div><strong>Tariff rows and version IDs are not present</strong><p>Rates must come from the insurer-provider agreement effective on each claim’s service date. No rates are inferred from the correction amounts.</p></div></div></Panel>
  </>;
}

function Authorizations() {
  return <><Heading eyebrow="HEALTH RECORDS / AUTHORIZATIONS" title="Authorizations" subtitle="Service-specific preauthorization requests, decisions, ceilings and evidence." action={<Link className="button button-primary" href="/authorizations/new">＋ New request</Link>} />
    <PreviewNote>Prior authorization request and ceiling matching are enabled for Task T09. Submissions link to service-date tariffs and claim encounters.</PreviewNote>
    <Panel title={case001.authorization} kicker="REFERENCE AUTHORIZATION"><div className="record-heading"><span className="record-symbol violet-symbol">◉</span><div><strong>MRI brain without contrast</strong><span>{case001.member} · {case001.provider}</span></div><span className="status-pill status-reference">Approved reference</span></div><div className="context-grid contract-grid"><Context label="Member policy" value={case001.policy} /><Context label="Encounter" value="22 Sep 2026" /><Context label="Service date validity" value="22 Sep 2026" /><Context label="Approved ceiling" value={kes(25000)} /><Context label="Decision actor / time" value="Not supplied" /><Context label="Evidence reference" value={case001.authorization} /></div></Panel>
  </>;
}

function Rules() {
  return <><Heading eyebrow="CONFIGURATION / COVERAGE RULES" title="Policy & rules" subtitle="Inspect the exact coverage, contract and adjudication versions used to assess claims." action={<DisabledAction>＋ Draft new version</DisabledAction>} />
    <PreviewNote>Catalogue structure is scaffolded. The reference fixture does not contain published rule IDs, clause references, effective periods or version numbers.</PreviewNote>
     <div className="rules-toolbar"><div className="tabs">{["All rules", "Published", "Drafts", "History"].map((tab, index) => <button className={`tab${index === 0 ? " active" : ""}`} type="button" key={tab} onClick={() => window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: `${tab} catalogue filter selected. Only reference rules are loaded; live policy records are unavailable.` }))}>{tab}</button>)}</div><span className="muted-label">SERVICE-DATE VERSIONING</span></div>
    <Panel title="Assessment references" kicker="CASE 001 · OBSERVED BASIS"><div className="rule-catalogue">{ruleBasis.map((rule) => <article className="rule-card" key={rule.title}><span className={`rule-icon ${rule.tone}`}>≋</span><div className="rule-main"><div className="rule-title-row"><strong>{rule.title}</strong><span className="status-pill status-unavailable">Version unavailable</span></div><p>{rule.detail}</p><div className="rule-metadata"><span>{rule.version}</span><span>Source clause not supplied</span><span>Effective dates not supplied</span></div></div><span className="rule-chevron">›</span></article>)}</div></Panel>
    <div className="content-grid rules-lower">
       <Panel title="Version lifecycle" kicker="PROPOSED RECORD STATES"><div className="lifecycle"><LifeState number="01" title="Draft" text="Author edits a new version" /><LifeState number="02" title="In review" text="Authorized reviewer checks source and tests" /><LifeState number="03" title="Approved" text="Independent approver (not the author) approves publication" /><LifeState number="04" title="Published" text="Effective date makes version selectable" /><LifeState number="05" title="Superseded" text="Retained for historical assessments" /></div></Panel>
        <Panel title="Publication governance" kicker="D15 · GUARDRAIL APPROVED"><div className="governance-note"><span className="governance-icon">⌑</span><div><strong>Insurer owns its policy rules</strong><p>Every publication requires an independent insurer-authorized approver distinct from the rule author. The insurer&apos;s accountable owner and drafter role titles remain to be confirmed.</p></div></div><div className="delegation-note"><strong>TPA permission</strong><p>TPAs cannot publish insurer rules unless the insurer explicitly grants scoped permission. Delegation scope and controls remain to be defined.</p></div><p className="source-footnote">Pattern informed by role-based product administration and separation-of-duties guidance.</p></Panel>
    </div>
  </>;
}
function LifeState({ number, title, text }: { number: string; title: string; text: string }) { return <div className="life-state"><span>{number}</span><div><strong>{title}</strong><small>{text}</small></div></div>; }

function Reviews() {
  return <><Heading eyebrow="WORKSPACE / REVIEW" title="Review workbench" subtitle="Trace every finding to the claim line, evidence and exact coverage/rule version." action={<span className="status-pill status-unavailable">Actions not connected</span>} />
    <Panel title="Review queue" kicker="REFERENCE WORKFLOWS"><div className="table-scroll"><table><thead><tr><th>Case</th><th>Member</th><th>Workflow</th><th>Status</th></tr></thead><tbody>{referenceCases.filter((claim) => ["Authorization pending", "Clarification requested", "Appeal open"].includes(claim.status)).map((claim) => <tr key={claim.fixtureId}><td><Link className="table-primary-link" href={`/claims/${claim.fixtureId.toLowerCase()}`}>{claim.fixtureId}</Link></td><td>{claim.member}</td><td>{claim.workflow}</td><td><span className="status-pill status-reference">{claim.status}</span></td></tr>)}</tbody></table></div></Panel>
    <div className="review-banner"><div><span className="panel-kicker">REFERENCE CASE 001</span><strong>{case001.member} · {case001.provider}</strong><span>{case001.policy} · Service date {case001.serviceDate}</span></div><div className="review-total"><span>Billed</span><strong>{kes(case001.billed)}</strong></div><div className="review-total"><span>Proposed correction</span><strong className="correction-cell">− {kes(case001.correction)}</strong></div><div className="review-total"><span>Eligible</span><strong>{kes(case001.eligible)}</strong></div></div>
    <Panel title="Line findings" kicker="5 ADJUSTED LINES · KES 6,400 TOTAL"><div className="table-scroll"><table><thead><tr><th>Finding</th><th>Observed basis</th><th>Source/version</th><th>Correction</th><th>Reviewer action</th></tr></thead><tbody>{case001.lines.filter(line => line.correction > 0).map((line) => <tr key={line.id}><td><strong>{line.id} · {line.service}</strong><small className="table-sub">Billed {kes(line.billed)}</small></td><td>{line.basis}<small className="table-sub">Eligible {kes(line.eligible)}</small></td><td><span className="status-pill status-unavailable">Rule version missing</span><small className="table-sub">Clause/evidence ID not supplied</small></td><td className="money-cell correction-cell">− {kes(line.correction)}</td><td><span className="decision-placeholder">Awaiting connected reviewer workflow</span></td></tr>)}</tbody></table></div></Panel>
    <div className="content-grid rules-lower"><Panel title="Reviewer decision" kicker="PROPOSED ACTIONS"><p className="panel-copy">Decisions should be recorded against a finding and assessment version with actor, reason and evidence.</p><div className="decision-actions"><DisabledAction>Accept finding</DisabledAction><DisabledAction>Request clarification</DisabledAction><DisabledAction>Dispute / override</DisabledAction></div></Panel><Panel title="Correction and appeal path" kicker="PROPOSED · NEEDS INSURER APPROVAL"><ol className="appeal-steps"><li><strong>Correction request</strong><span>Reviewer cites affected line, rule and evidence.</span></li><li><strong>Provider response</strong><span>Submit a new claim version or dispute with reason/evidence.</span></li><li><strong>Reassessment</strong><span>Run rules against the corrected version; preserve prior result.</span></li><li><strong>Appeal after adverse decision</strong><span>Separate reviewer records uphold, adjust or remand with reasons.</span></li></ol></Panel></div>
  </>;
}

function Settlements() {
  return <><Heading eyebrow="FINANCE / SETTLEMENTS" title="Settlements" subtitle="Approved insurer payables, payment references and receipt reconciliation." />
    <PreviewNote>Amounts below are local reference values. No bank or payment network is connected.</PreviewNote>
    <Panel title="Payable and reconciliation queue" kicker="REFERENCE WORKFLOWS"><div className="table-scroll"><table><thead><tr><th>Case</th><th>Provider</th><th>Insurer payable</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{referenceCases.filter((claim) => ["Paid / reconciled", "Approved / awaiting payment", "Partially reconciled"].includes(claim.status)).map((claim) => <tr key={claim.fixtureId}><td>{claim.fixtureId}</td><td>{claim.provider}</td><td className="money-cell">{kes(claim.insurerShare)}</td><td className="money-cell">{kes(claim.variance)}</td><td><span className="status-pill status-reference">{claim.status}</span></td></tr>)}</tbody></table></div></Panel>
    <div className="metric-grid settlement-metrics"><article className="metric-card"><div className="metric-top"><span>Eligible cost</span><span className="metric-icon blue">KES</span></div><strong className="metric-value">{kes(case001.eligible)}</strong><span className="metric-meta">Reference Case 001</span></article><article className="metric-card"><div className="metric-top"><span>Member share</span><span className="metric-icon violet">M</span></div><strong className="metric-value">{kes(case001.memberShare)}</strong><span className="metric-meta">10% · fixture only</span></article><article className="metric-card"><div className="metric-top"><span>Insurer payable</span><span className="metric-icon green">I</span></div><strong className="metric-value">{kes(case001.insurerShare)}</strong><span className="metric-meta">Payment is simulated</span></article><article className="metric-card"><div className="metric-top"><span>Remaining benefit</span><span className="metric-icon amber">B</span></div><strong className="metric-value">{kes(case001.remainingBenefit)}</strong><span className="metric-meta">After fixture posting</span></article></div>
    <Panel title="Payment and reconciliation" kicker="REFERENCE CASE 001" extra={<span className="status-pill status-reference">Simulated</span>}><div className="settlement-flow"><FlowStep number="01" title="Approved payable" value={kes(case001.insurerShare)} text="Exact claim version approval required" /><span className="flow-arrow">→</span><FlowStep number="02" title="Payment recorded" value={kes(case001.insurerShare)} text="Fixture date: 02 Oct 2026" /><span className="flow-arrow">→</span><FlowStep number="03" title="Receipt matched" value={kes(case001.variance)} text="Expected variance: zero" /></div><div className="inline-callout"><span>ⓘ</span><p>No bank instructions, batch transfer, receipt identifier or executed payment exists in this fixture.</p></div></Panel>
    <div className="form-actions"><span>Finance role can record payment and reconcile; it cannot change claim adjudication.</span><DisabledAction>Record simulated payment</DisabledAction></div>
  </>;
}
function FlowStep({ number, title, value, text }: { number: string; title: string; value: string; text: string }) { return <div className="flow-step"><span>{number}</span><small>{title}</small><strong>{value}</strong><p>{text}</p></div>; }

function Reports() {
  return <><Heading eyebrow="GOVERNANCE / REPORTS" title="Operational reports" subtitle="Track claim workload, review progress, outstanding payables and reconciliation." />
    <PreviewNote>Reference-case counts are local only. Live reporting requires the authorized reporting API. Loss ratio requires approved premium and incurred-loss inputs.</PreviewNote>
     <div className="report-filter"><span className="filter-label">REPORTING PERIOD</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: "Reporting-period options need the reporting API. No period has been selected." }))}>Not set in fixture <span>⌄</span></button><span className="muted-label">Updated from source: unavailable</span></div>
    <div className="report-grid"><ReportCard label="Claim activity" metric={`${referenceCases.length} reference cases`} note="Not a live count" icon="▤" /><ReportCard label="Review exceptions" metric={`${referenceCases.filter((claim) => ["Authorization pending", "Clarification requested", "Appeal open"].includes(claim.status)).length} open`} note="Authorization, clarification and appeal" icon="✓" /><ReportCard label="Approved payable" metric={kes(referenceCases.filter((claim) => ["Paid / reconciled", "Approved / awaiting payment", "Partially reconciled"].includes(claim.status)).reduce((sum, claim) => sum + claim.insurerShare, 0))} note="Reference calculation only" icon="↗" /><ReportCard label="Outstanding" metric={kes(referenceCases.filter((claim) => ["Paid / reconciled", "Approved / awaiting payment", "Partially reconciled"].includes(claim.status)).reduce((sum, claim) => sum + claim.variance, 0))} note="Awaiting or partial payment" icon="＝" /></div>
    <Panel title="Loss ratio" kicker="UNAVAILABLE · INPUTS NOT APPROVED"><div className="unavailable-metric"><span className="unavailable-lock">⊘</span><div><strong>No loss ratio available</strong><p>Earned premium, incurred claims/reserves, reporting period, cohort and gross/net definition are required. A benefit limit is not a premium.</p></div><span className="status-pill status-unavailable">No approved inputs</span></div></Panel>
  </>;
}
function ReportCard({ label, metric, note, icon }: { label: string; metric: string; note: string; icon: string }) { return <article className="report-card"><span className="report-icon">{icon}</span><span>{label}</span><strong>{metric}</strong><small>{note}</small></article>; }

function Audit() {
  return <><Heading eyebrow="GOVERNANCE / AUDIT" title="Audit history" subtitle="Trace changes and decisions to a named actor, organization, timestamp, reason and record version." />
    <PreviewNote>The fixture provides a reference timeline, not persisted system audit events. The connected audit view must be server-authorized and append-only.</PreviewNote>
    <Panel title="Case progression" kicker="LOCAL REFERENCE EVENTS"><div className="audit-list">{referenceCases.flatMap((claim) => claim.timeline.map((event) => ({ claim, event }))).map(({ claim, event }, i) => <article className="audit-item" key={`${claim.fixtureId}-${i}`}><span className="audit-marker">{String(i + 1).padStart(2, "0")}</span><div className="audit-event"><div><strong>{claim.fixtureId} · {event.title}</strong><span className="audit-date">{event.date}</span></div><p>{event.detail}</p><small>Reference event · actor and audit event ID not supplied</small></div></article>)}</div></Panel>
    <div className="audit-guidance"><strong>Production audit record should include</strong><span>Actor and organization</span><span>Action and reason</span><span>Claim / rule version</span><span>Event time and source</span></div>
  </>;
}

function EmptySection({ title }: { title: string }) { return <><Heading eyebrow="HEALTH CLAIMS" title={title} subtitle="This section is part of the approved health claims workflow scaffold." /><PreviewNote>Section data will be supplied by the approved API. No sample values are invented here.</PreviewNote><div className="empty-api-state"><span className="empty-icon">⌕</span><div><strong>Section scaffold ready</strong><p>Connect the approved API contract to display organization-scoped records and actions.</p></div></div></>; }
