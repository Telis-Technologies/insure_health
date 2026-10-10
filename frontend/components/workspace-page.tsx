"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { case001, demoAuthorizations, demoMembers, demoPolicies, demoProviders, demoTenant, kes, ruleBasis } from "@/lib/demo-data";

const pageNames: Record<string, string> = {
  claims: "Claims", members: "Members", policies: "Policies & benefits", providers: "Provider network",
  authorizations: "Authorizations", rules: "Policy & rules", reviews: "Claim review",
  settlements: "Settlements", reports: "Operational reports", audit: "Audit history", access: "Access & roles",
};

export function WorkspacePage({ slug }: { slug: string[] }) {
  const section = slug[0] ?? "claims";
  const title = pageNames[section] ?? "Health claims";

  if (section === "claims" && slug[1] === "new") return <ClaimIntake />;
  if (section === "claims" && slug.length > 1) return <ClaimDetail />;
  if (section === "claims") return <ClaimsList />;
  if (section === "members") return <Members />;
  if (section === "policies") return <Policies />;
  if (section === "providers") return <Providers />;
  if (section === "authorizations") return <Authorizations />;
  if (section === "rules") return <Rules />;
  if (section === "reviews") return <Reviews />;
  if (section === "settlements") return <Settlements />;
  if (section === "reports") return <Reports />;
  if (section === "audit") return <Audit />;
  if (section === "access") return <Access />;
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
function Field({ label, value, hint }: { label: string; value?: string; hint?: string }) { return <label className="form-field"><span>{label}</span><input defaultValue={value ?? ""} placeholder={hint ?? "Not supplied in reference fixture"} /></label>; }
function RecordCard({ label, title, subtitle, rows }: { label: string; title: string; subtitle: string; rows: [string, string][] }) {
  return <section className="record-card"><p className="record-card-label">{label}</p><h2>{title}</h2><p className="record-card-subtitle">{subtitle}</p>{rows.map(([key, value]) => <div className="record-row" key={key}><span>{key}</span><strong>{value}</strong></div>)}</section>;
}

function ClaimsList() {
  return <>
    <Heading eyebrow="WORKSPACE / CLAIMS" title="Claims" subtitle="Submitted health claims, their current review state and supporting evidence." action={<Link className="button button-primary" href="/claims/new">＋ New claim</Link>} />
    <PreviewNote>Only the synthetic reference case is loaded. Queue filters and status totals will use the API when it is available.</PreviewNote>
    <Panel title="Claim register" kicker="1 REFERENCE CASE" extra={<span className="muted-label">Service date: 22 Sep 2026</span>}>
      <div className="table-scroll"><table><thead><tr><th>Claim</th><th>Member / policy</th><th>Provider</th><th>Service date</th><th>Billed</th><th>Reference</th></tr></thead>
        <tbody><tr><td><Link className="table-primary-link" href="/claims/reference-case-001">Reference Case 001 <span>↗</span></Link><small className="table-sub">Synthetic fixture</small></td><td>{case001.member}<small className="table-sub">{case001.policy}</small></td><td>{case001.provider}</td><td>{case001.serviceDate}</td><td className="money-cell">{kes(case001.billed)}</td><td><span className="status-pill status-reference">Reference only</span></td></tr></tbody>
      </table></div>
    </Panel>
    <div className="empty-api-state"><span className="empty-icon">⌕</span><div><strong>Live claim queue not connected</strong><p>Filters, claim status and counts will come from the approved claims API. The page does not substitute fixture data for a live response.</p></div></div>
  </>;
}

function ClaimIntake() {
  const [member, setMember] = useState("");
  const [policy, setPolicy] = useState("");
  const [provider, setProvider] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [serviceDate, setServiceDate] = useState("2026-10-10");
  const [message, setMessage] = useState("");
  const memberChoices = useMemo(() => demoMembers.map((item) => `${item.id} · ${item.name}`), []);
  const providerChoices = useMemo(() => demoProviders.map((item) => `${item.id} · ${item.name}`), []);
  const policyChoices = useMemo(() => demoPolicies.map((item) => `${item.id} · ${item.name}`), []);
  const authChoices = useMemo(() => demoAuthorizations.map((item) => `${item.id} · ${item.service}`), []);
  const memberId = member.split(" · ")[0];
  const selectedMember = demoMembers.find((item) => item.id === memberId);
  const availableAuthorizations = demoAuthorizations.filter((item) => !memberId || item.memberId === memberId);
  const availablePolicies = selectedMember ? policyChoices.filter((item) => item.startsWith(`${selectedMember.policyId} ·`)) : policyChoices;
  const submitPreview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = [
      !memberChoices.includes(member) && "Choose a member from the synthetic directory.",
      !availablePolicies.includes(policy) && "Choose a policy valid for the selected member.",
      !providerChoices.includes(provider) && "Choose a contracted synthetic provider.",
      !serviceDate && "Enter the service date.",
      authorization && (!authChoices.includes(authorization) || !availableAuthorizations.some((item) => `${item.id} · ${item.service}` === authorization)) && "Choose an authorization for the selected member from the available list or leave it blank.",
    ].filter(Boolean);
    setMessage(errors.length ? errors.join(" ") : "The selections are valid for this preview. Claim submission is not connected; nothing was saved.");
  };
  return <>
    <Heading eyebrow="WORKSPACE / CLAIMS / NEW" title="Start a claim" subtitle="Create a structured provider submission with the member, service and evidence details." action={<Link className="button button-outline" href="/claims">← Back to claims</Link>} />
    <PreviewNote>This form is a frontend scaffold. Claim submission and document upload are not connected; use synthetic data only.</PreviewNote>
    <div className="form-layout">
      <div className="form-main">
        <form onSubmit={submitPreview} noValidate>
        <Panel title="Claim details" kicker="STEP 1 · MEMBER & ENCOUNTER">
          <div className="form-grid">
            <label className="form-field"><span>Member reference · search or choose</span><input list="demo-members" value={member} onChange={(event) => { setMember(event.target.value); setPolicy(""); setAuthorization(""); }} placeholder="Type member ID or synthetic name" required /><datalist id="demo-members">{memberChoices.map((choice) => <option key={choice} value={choice} />)}</datalist></label>
            <label className="form-field"><span>Policy · selected member&apos;s policy</span><input list="demo-policies" value={policy} onChange={(event) => setPolicy(event.target.value)} placeholder="Search policy" required /><datalist id="demo-policies">{availablePolicies.map((choice) => <option key={choice} value={choice} />)}</datalist></label>
            <label className="form-field"><span>Provider facility · search or choose</span><input list="demo-providers" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Type facility ID or name" required /><datalist id="demo-providers">{providerChoices.map((choice) => <option key={choice} value={choice} />)}</datalist></label>
            <label className="form-field"><span>Service date</span><input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required /></label>
            <Field label="Encounter reference" hint="Facility encounter ID" />
            <label className="form-field"><span>Preauthorization · optional</span><input list="demo-authorizations" value={authorization} onChange={(event) => setAuthorization(event.target.value)} placeholder="Search authorization or leave blank" /><datalist id="demo-authorizations">{availableAuthorizations.map((item) => <option key={item.id} value={`${item.id} · ${item.service}`} />)}</datalist></label>
          </div>
          <p className="form-helper">Tenant: {demoTenant}. Directory entries are synthetic; service date governs coverage-version selection.</p>
        </Panel>
        <Panel title="Bill lines" kicker="STEP 2 · SERVICES">
          <div className="table-scroll"><table><thead><tr><th>Service code</th><th>Description</th><th>Qty</th><th>Amount (KES)</th><th /></tr></thead><tbody><tr><td colSpan={5} className="blank-row">No bill lines added in this preview form.</td></tr></tbody></table></div>
          <DisabledAction>＋ Add bill line</DisabledAction>
        </Panel>
        <Panel title="Supporting documents" kicker="STEP 3 · EVIDENCE">
          <div className="upload-placeholder"><span className="upload-icon">⇧</span><div><strong>Attach bill or authorization evidence</strong><span>File limits and private storage are pending. Upload is disabled in this scaffold.</span></div><DisabledAction>Choose file</DisabledAction></div>
          <p className="form-helper">Never attach real patient documents to this local synthetic preview.</p>
        </Panel>
        <div className="form-actions"><span>Required selections are checked locally; no data is persisted.</span><button className="button button-primary" type="submit">Validate claim details</button></div>
        {message ? <p role="status" className="form-helper">{message}</p> : null}
        </form>
      </div>
      <aside className="side-rail"><Panel title="Before you submit" kicker="CHECKLIST"><ul className="check-list"><li>Confirm member and policy are valid for the service date.</li><li>Confirm the provider contract covers the facility and service.</li><li>Attach authorization evidence where required.</li><li>Keep the original bill; corrections create a new version.</li></ul></Panel><Panel title="Assessment trace" kicker="AFTER SUBMISSION"><div className="trace-mini"><span>1</span><p>Policy and benefit version selected by service date</p></div><div className="trace-mini"><span>2</span><p>Applicable contract, tariff and rule versions captured</p></div><div className="trace-mini"><span>3</span><p>Findings cite rule versions and evidence</p></div></Panel></aside>
    </div>
  </>;
}

function ClaimDetail() {
  return <>
    <div className="back-row"><Link href="/claims">← Claims</Link><span>/</span><span>Reference Case 001</span></div>
    <Heading eyebrow="CLAIM DETAIL · SYNTHETIC REFERENCE" title="Reference Case 001" subtitle={`${case001.member} · ${case001.policy} · ${case001.serviceDate}`} action={<span className="status-pill status-reference">Fixture only</span>} />
    <PreviewNote>Amounts and parties below are synthetic fixture facts. The fixture does not include persisted app event IDs or the rule-version identifiers used.</PreviewNote>
    <section className="detail-hero-grid">
      <div className="panel detail-amount-card"><div className="panel-kicker">BILLED AMOUNT</div><strong>{kes(case001.billed)}</strong><span>Original provider bill · 6 lines</span><div className="detail-amount-divider" /><div className="hero-pairs"><span>Eligible after corrections</span><strong>{kes(case001.eligible)}</strong><span>Insurer share</span><strong>{kes(case001.insurerShare)}</strong><span>Member share</span><strong>{kes(case001.memberShare)}</strong></div></div>
      <div className="panel"><div className="panel-header"><div><p className="panel-kicker">PARTIES & COVERAGE</p><h2>Claim context</h2></div></div><div className="context-grid"><Context label="Member" value={case001.member} /><Context label="Insurer" value={case001.insurer} /><Context label="Provider" value={case001.provider} /><Context label="TPA" value={case001.tpa} /><Context label="Policy" value={case001.policy} /><Context label="Provider contract" value={case001.contract} /><Context label="Authorization" value={case001.authorization} /><Context label="Service date" value={case001.serviceDate} /></div></div>
    </section>
    <div className="two-column-stack">
      <Panel title="Submitted bill lines" kicker="ORIGINAL VERSION · FIXTURE VALUES">
        <div className="table-scroll"><table><thead><tr><th>Line</th><th>Service</th><th>Billed</th><th>Correction</th><th>Eligible</th></tr></thead><tbody>{case001.lines.map((line) => <tr key={line.id}><td><span className="line-id">{line.id}</span></td><td>{line.service}<small className="table-sub">{line.basis}</small></td><td className="money-cell">{kes(line.billed)}</td><td className={line.correction ? "money-cell correction-cell" : "money-cell"}>{line.correction ? `− ${kes(line.correction)}` : "—"}</td><td className="money-cell">{kes(line.eligible)}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Total</td><td>{kes(case001.billed)}</td><td>− {kes(case001.correction)}</td><td>{kes(case001.eligible)}</td></tr></tfoot></table></div>
      </Panel>
      <Panel title="Assessment versions" kicker="VERSION TRACE">
        <div className="version-empty"><span className="version-icon">↻</span><div><strong>Version IDs not present in fixture</strong><p>In the integrated system, each submitted or corrected claim version gets an immutable ID. Every assessment must link to one exact claim version and the exact policy, tariff and rule versions used.</p></div></div>
      </Panel>
    </div>
    <section className="detail-actions"><Link className="button button-outline" href="/reviews">Open review workbench <span>↗</span></Link><Link className="button button-outline" href="/settlements">View settlement <span>↗</span></Link><Link className="button button-outline" href="/audit">View reference timeline <span>↗</span></Link></section>
  </>;
}
function Context({ label, value }: { label: string; value: string }) { return <div className="context-item"><span>{label}</span><strong>{value}</strong></div>; }

function Members() {
  return <><Heading eyebrow="HEALTH RECORDS / MEMBERS" title="Members" subtitle="Insured members and their policy relationships, scoped to the authorized organization." />
    <PreviewNote>50 deterministic synthetic member records for one demo insurer tenant. No real personal data is included.</PreviewNote>
    <Panel title="Member directory" kicker={`${demoMembers.length} SYNTHETIC MEMBERS`}><div className="table-scroll"><table><thead><tr><th>Member reference</th><th>Policy</th><th>Insurer tenant</th><th>Status</th><th>Data mode</th></tr></thead><tbody>{demoMembers.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small className="table-sub">{member.id}</small></td><td>{member.policyName}<small className="table-sub">{member.policyId}</small></td><td>{member.insurer}</td><td>{member.status}</td><td><span className="status-pill status-reference">Synthetic</span></td></tr>)}</tbody></table></div></Panel>
  </>;
}

function Policies() {
  return <><Heading eyebrow="HEALTH RECORDS / COVERAGE" title="Policies & benefits" subtitle="Coverage terms and benefit balances selected for the member and service date." />
    <PreviewNote>{demoPolicies.length} synthetic plan variants are available for the 50 demo members in one tenant. No policy terms or version IDs are represented as live insurer rules.</PreviewNote>
    <div className="record-cards">{demoPolicies.map((policy) => <RecordCard key={policy.id} label={`POLICY · ${policy.type.toUpperCase()}`} title={policy.name} subtitle={`${demoTenant} · ${policy.id}`} rows={[["Benefit type", policy.type], ["Illustrative annual limit", kes(policy.limit)], ["Effective period / version", "Not supplied"], ["Member enrollment", `${demoMembers.filter((member) => member.policyId === policy.id).length} synthetic members`], ["Rule source", "No insurer rule version attached"]]} />)}<RecordCard label="MEMBER BENEFIT" title="Reference calculation" subtitle="Claim 001 only · fixture amounts" rows={[["Eligible cost", kes(case001.eligible)], ["Member share", kes(case001.memberShare)], ["Insurer share", kes(case001.insurerShare)], ["Remaining benefit", kes(case001.remainingBenefit)], ["Benefit consumption basis", "Insurer share · fixture only"]]} /></div>
  </>;
}

function Providers() {
  return <><Heading eyebrow="HEALTH RECORDS / NETWORK" title="Provider network" subtitle="Insurer-provider agreements, participating facilities and versioned service tariffs." />
    <PreviewNote>20 deterministic synthetic facilities for one demo insurer tenant. Contracts and tariff rates are illustrative and not persisted.</PreviewNote>
    <Panel title="Contracted provider facilities" kicker={`${demoProviders.length} SYNTHETIC PROVIDERS`}><div className="table-scroll"><table><thead><tr><th>Facility</th><th>County</th><th>Contract</th><th>Insurer tenant</th><th>Status</th></tr></thead><tbody>{demoProviders.map((provider) => <tr key={provider.id}><td><strong>{provider.name}</strong><small className="table-sub">{provider.id}</small></td><td>{provider.county}</td><td>{provider.contractId}</td><td>{provider.insurer}</td><td>{provider.status}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="Tariff versions" kicker="SERVICE RATE CATALOGUE"><div className="empty-state-inline"><span>≋</span><div><strong>Tariff rows and version IDs are not present</strong><p>Rates must come from the insurer-provider agreement effective on each claim’s service date. No rates are inferred from the correction amounts.</p></div></div></Panel>
  </>;
}

function Authorizations() {
  return <><Heading eyebrow="HEALTH RECORDS / AUTHORIZATIONS" title="Authorizations" subtitle="Service-specific preauthorization requests, decisions, ceilings and evidence." action={<DisabledAction>＋ New request</DisabledAction>} />
    <PreviewNote>Request and review screens are scaffolded. Submission and decision actions remain unavailable until API and access controls are connected.</PreviewNote>
    <Panel title="AUTH-001" kicker="REFERENCE AUTHORIZATION"><div className="record-heading"><span className="record-symbol violet-symbol">◉</span><div><strong>MRI brain without contrast</strong><span>{case001.member} · {case001.provider}</span></div><span className="status-pill status-reference">Fixture only</span></div><div className="context-grid contract-grid"><Context label="Member policy" value={case001.policy} /><Context label="Encounter" value="22 Sep 2026" /><Context label="Service date validity" value="22 Sep 2026" /><Context label="Approved ceiling" value={kes(25000)} /><Context label="Decision actor / time" value="Not supplied" /><Context label="Evidence reference" value="AUTH-001" /></div><div className="inline-callout"><span>ⓘ</span><p>Authorization supports the assessment but is not a blanket guarantee that every billed item will be paid.</p></div></Panel>
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
    <PreviewNote>Reference findings below reproduce fixture arithmetic. Exact rule versions and source clauses are missing, so these are not operational adjudication results.</PreviewNote>
    <div className="review-banner"><div><span className="panel-kicker">REFERENCE CASE 001</span><strong>{case001.member} · {case001.provider}</strong><span>{case001.policy} · Service date {case001.serviceDate}</span></div><div className="review-total"><span>Billed</span><strong>{kes(case001.billed)}</strong></div><div className="review-total"><span>Proposed correction</span><strong className="correction-cell">− {kes(case001.correction)}</strong></div><div className="review-total"><span>Eligible</span><strong>{kes(case001.eligible)}</strong></div></div>
    <Panel title="Line findings" kicker="5 ADJUSTED LINES · KES 6,400 TOTAL"><div className="table-scroll"><table><thead><tr><th>Finding</th><th>Observed basis</th><th>Source/version</th><th>Correction</th><th>Reviewer action</th></tr></thead><tbody>{case001.lines.filter(line => line.correction > 0).map((line) => <tr key={line.id}><td><strong>{line.id} · {line.service}</strong><small className="table-sub">Billed {kes(line.billed)}</small></td><td>{line.basis}<small className="table-sub">Eligible {kes(line.eligible)}</small></td><td><span className="status-pill status-unavailable">Rule version missing</span><small className="table-sub">Clause/evidence ID not supplied</small></td><td className="money-cell correction-cell">− {kes(line.correction)}</td><td><span className="decision-placeholder">Awaiting connected reviewer workflow</span></td></tr>)}</tbody></table></div></Panel>
    <div className="content-grid rules-lower"><Panel title="Reviewer decision" kicker="PROPOSED ACTIONS"><p className="panel-copy">Decisions should be recorded against a finding and assessment version with actor, reason and evidence.</p><div className="decision-actions"><DisabledAction>Accept finding</DisabledAction><DisabledAction>Request clarification</DisabledAction><DisabledAction>Dispute / override</DisabledAction></div></Panel><Panel title="Correction and appeal path" kicker="PROPOSED · NEEDS INSURER APPROVAL"><ol className="appeal-steps"><li><strong>Correction request</strong><span>Reviewer cites affected line, rule and evidence.</span></li><li><strong>Provider response</strong><span>Submit a new claim version or dispute with reason/evidence.</span></li><li><strong>Reassessment</strong><span>Run rules against the corrected version; preserve prior result.</span></li><li><strong>Appeal after adverse decision</strong><span>Separate reviewer records uphold, adjust or remand with reasons.</span></li></ol></Panel></div>
  </>;
}

function Settlements() {
  return <><Heading eyebrow="FINANCE / SETTLEMENTS" title="Settlements" subtitle="Approved insurer payables, payment references and receipt reconciliation." />
    <PreviewNote>Amounts below are expected values for a synthetic case. Payment capture is simulated; no bank or payment network is connected.</PreviewNote>
    <div className="metric-grid settlement-metrics"><article className="metric-card"><div className="metric-top"><span>Eligible cost</span><span className="metric-icon blue">KES</span></div><strong className="metric-value">{kes(case001.eligible)}</strong><span className="metric-meta">Reference Case 001</span></article><article className="metric-card"><div className="metric-top"><span>Member share</span><span className="metric-icon violet">M</span></div><strong className="metric-value">{kes(case001.memberShare)}</strong><span className="metric-meta">10% · fixture only</span></article><article className="metric-card"><div className="metric-top"><span>Insurer payable</span><span className="metric-icon green">I</span></div><strong className="metric-value">{kes(case001.insurerShare)}</strong><span className="metric-meta">Payment is simulated</span></article><article className="metric-card"><div className="metric-top"><span>Remaining benefit</span><span className="metric-icon amber">B</span></div><strong className="metric-value">{kes(case001.remainingBenefit)}</strong><span className="metric-meta">After fixture posting</span></article></div>
    <Panel title="Payment and reconciliation" kicker="REFERENCE CASE 001" extra={<span className="status-pill status-reference">Simulated</span>}><div className="settlement-flow"><FlowStep number="01" title="Approved payable" value={kes(case001.insurerShare)} text="Exact claim version approval required" /><span className="flow-arrow">→</span><FlowStep number="02" title="Payment recorded" value={kes(case001.insurerShare)} text="Fixture date: 02 Oct 2026" /><span className="flow-arrow">→</span><FlowStep number="03" title="Receipt matched" value={kes(case001.variance)} text="Expected variance: zero" /></div><div className="inline-callout"><span>ⓘ</span><p>No bank instructions, batch transfer, receipt identifier or executed payment exists in this fixture.</p></div></Panel>
    <div className="form-actions"><span>Finance role can record payment and reconcile; it cannot change claim adjudication.</span><DisabledAction>Record simulated payment</DisabledAction></div>
  </>;
}
function FlowStep({ number, title, value, text }: { number: string; title: string; value: string; text: string }) { return <div className="flow-step"><span>{number}</span><small>{title}</small><strong>{value}</strong><p>{text}</p></div>; }

function Reports() {
  return <><Heading eyebrow="GOVERNANCE / REPORTS" title="Operational reports" subtitle="Track claim workload, review progress, outstanding payables and reconciliation." />
    <PreviewNote>Only one synthetic reference case is available. Live counts require the authorized reporting API. Loss ratio is unavailable because approved premium and incurred-loss inputs are not supplied.</PreviewNote>
     <div className="report-filter"><span className="filter-label">REPORTING PERIOD</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: "Reporting-period options need the reporting API. No period has been selected." }))}>Not set in fixture <span>⌄</span></button><span className="muted-label">Updated from source: unavailable</span></div>
    <div className="report-grid"><ReportCard label="Claim activity" metric="1 reference case" note="Not a live count" icon="▤" /><ReportCard label="Line review" metric="5 adjusted lines" note={`${kes(case001.correction)} in fixture corrections`} icon="✓" /><ReportCard label="Insurer payable" metric={kes(case001.insurerShare)} note="Reference calculation only" icon="↗" /><ReportCard label="Reconciliation" metric={`${kes(case001.variance)} variance`} note="Expected exact match" icon="＝" /></div>
    <Panel title="Loss ratio" kicker="UNAVAILABLE · INPUTS NOT APPROVED"><div className="unavailable-metric"><span className="unavailable-lock">⊘</span><div><strong>No loss ratio available</strong><p>Earned premium, incurred claims/reserves, reporting period, cohort and gross/net definition are required. A benefit limit is not a premium.</p></div><span className="status-pill status-unavailable">No approved inputs</span></div></Panel>
  </>;
}
function ReportCard({ label, metric, note, icon }: { label: string; metric: string; note: string; icon: string }) { return <article className="report-card"><span className="report-icon">{icon}</span><span>{label}</span><strong>{metric}</strong><small>{note}</small></article>; }

function Audit() {
  return <><Heading eyebrow="GOVERNANCE / AUDIT" title="Audit history" subtitle="Trace changes and decisions to a named actor, organization, timestamp, reason and record version." />
    <PreviewNote>The fixture provides a reference timeline, not persisted system audit events. The connected audit view must be server-authorized and append-only.</PreviewNote>
    <Panel title="Reference case timeline" kicker="CASE 001 · SYNTHETIC SOURCE"><div className="audit-list">{case001.timeline.map((event, i) => <article className="audit-item" key={event.title}><span className="audit-marker">{String(i + 1).padStart(2, "0")}</span><div className="audit-event"><div><strong>{event.title}</strong><span className="audit-date">{event.date}</span></div><p>{event.detail}</p><small>Fixture event · actor and audit event ID not supplied</small></div></article>)}</div></Panel>
    <div className="audit-guidance"><strong>Production audit record should include</strong><span>Actor and organization</span><span>Action and reason</span><span>Claim / rule version</span><span>Event time and source</span></div>
  </>;
}

function Access() {
  const roles = [
    { role: "Provider biller", actions: "Create and submit own claims · attach supporting evidence · answer correction requests", limit: "Cannot review or approve own claim" },
    { role: "Insurer / TPA reviewer", actions: "Review authorized claims · inspect findings · request corrections · record decisions", limit: "Approval requires explicit authority" },
    { role: "Insurer approver", actions: "Approve the exact assessed claim version within assigned authority", limit: "Cannot approve stale or unresolved assessment" },
    { role: "Insurer finance", actions: "View approved payable · record payment reference · reconcile receipts", limit: "Cannot change claim findings or decision" },
    { role: "Insurer rule author / approver", actions: "Authorized author drafts; independent insurer-authorized approver publishes", limit: "Approver must differ from author; TPA needs scoped insurer delegation" },
  ];
  return <><Heading eyebrow="GOVERNANCE / ACCESS" title="Organizations & roles" subtitle="Access is scoped to an organization and explicit capabilities, then enforced by the API." />
      <PreviewNote>Identity now comes from Keycloak and this screen shows the proposed role boundaries. The API and access module must independently enforce membership, organization scope and permissions; frontend route filtering is not the security boundary.</PreviewNote>
    <Panel title="Health network organizations" kicker="CASE 001 · SYNTHETIC"><div className="org-list"><Org name={case001.provider} kind="Provider facility" mark="R" /><Org name={case001.insurer} kind="Insurer · policy owner" mark="H" /><Org name={case001.tpa} kind="TPA administrator" mark="M" /></div><div className="inline-callout"><span>ⓘ</span><p>One provider contract connects these reference parties. Real users may belong to multiple organizations; access must follow explicit organization grants.</p></div></Panel>
    <Panel title="Role capability boundaries" kicker="PROPOSED ACCESS MATRIX"><div className="table-scroll"><table><thead><tr><th>Role</th><th>Can do</th><th>Guardrail</th></tr></thead><tbody>{roles.map(row => <tr key={row.role}><td><strong>{row.role}</strong></td><td>{row.actions}</td><td>{row.limit}</td></tr>)}</tbody></table></div></Panel>
    <div className="governance-note access-governance"><span className="governance-icon">⌑</span><div><strong>Who should publish insurer rules?</strong><p>Recommendation: insurer product/benefits owner is accountable; a trained configuration analyst drafts; an independent insurer-authorized approver approves publication. TPA users need an explicit, scoped insurer delegation. Exact job titles and dual-approval policy require insurer sign-off.</p></div></div>
  </>;
}
function Org({ name, kind, mark }: { name: string; kind: string; mark: string }) { return <div className="org-item"><span className="org-avatar">{mark}</span><div><strong>{name}</strong><small>{kind}</small></div><span className="org-scope">Reference party</span></div>; }

function EmptySection({ title }: { title: string }) { return <><Heading eyebrow="HEALTH CLAIMS" title={title} subtitle="This section is part of the approved health claims workflow scaffold." /><PreviewNote>Section data will be supplied by the approved API. No sample values are invented here.</PreviewNote><div className="empty-api-state"><span className="empty-icon">⌕</span><div><strong>Section scaffold ready</strong><p>Connect the approved API contract to display organization-scoped records and actions.</p></div></div></>; }
