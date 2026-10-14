"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Claim, ClaimStatus, DocumentKind, PolicyVersion } from "@/lib/mvp-store";
import styles from "./claim-demo-mvp-polish.module.css";

type Persona = "provider" | "reviewer";
type ClaimForm = { member: string; provider: string; policy: string; service: string; serviceDate: string; amount: string };
const today = new Date().toISOString().slice(0, 10);
const blankClaim: ClaimForm = { member: "", provider: "Riverside Medical Centre", policy: "Afya Comprehensive", service: "", serviceDate: today, amount: "" };
const members = ["Amina Otieno", "Daniel Mwangi", "Wanjiku Wambui", "Brian Kiptoo", "Mercy Njeri", "Grace Wanjiku", "Joseph Omondi"];
const providers = ["Riverside Medical Centre", "Kilimani Family Clinic", "Westlands Community Hospital", "Parklands Specialist Centre", "Thika Road Medical Centre"];
const documentKinds: DocumentKind[] = ["Signed claim form", "Receipt / invoice", "Clinical report", "Pre-authorization", "Other evidence"];
const money = (amount: number) => `KES ${new Intl.NumberFormat("en-KE").format(amount)}`;
const statusClass = (status: ClaimStatus) => `status${status.replaceAll(" ", "")}`;
const displayDate = (date: string) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data as T;
}

export function ClaimDemoMvp({ initialPersona = "provider" }: { initialPersona?: Persona }) {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [view, setView] = useState<"claims" | "policies">("claims");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<PolicyVersion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("new");
  const [uploadDraftId, setUploadDraftId] = useState("");
  const [prefilledDraftId, setPrefilledDraftId] = useState("");
  const [uploadKind, setUploadKind] = useState<DocumentKind>("Signed claim form");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [claimForm, setClaimForm] = useState<ClaimForm>(blankClaim);
  const [uploadFields, setUploadFields] = useState<ClaimForm>(blankClaim);
  const [reviewNote, setReviewNote] = useState("");
  const [policyConfig, setPolicyConfig] = useState({ outpatientLimit: 30000, annualLimit: 550000, copayPercent: 10, authorizationThreshold: 50000 });
  const [policyEffectiveFrom, setPolicyEffectiveFrom] = useState(today);
  const [showPassedRules, setShowPassedRules] = useState(false);

  const refreshClaims = useCallback(async () => {
    const data = await readResponse<{ claims: Claim[] }>(await fetch("/api/claims", { cache: "no-store" }));
    setClaims(data.claims);
    setSelectedId((current) => current && data.claims.some((claim) => claim.id === current) ? current : (
      data.claims.find((claim) => persona === "provider"
        ? claim.status === "Needs correction" && claim.provider === "Riverside Medical Centre"
        : claim.id === "CLM-1047")?.id
      ?? data.claims.find((claim) => persona === "provider"
        ? claim.status === "Needs correction" && claim.provider === "Riverside Medical Centre"
        : ["Submitted", "Resubmitted"].includes(claim.status))?.id
      ?? data.claims[0]?.id ?? ""
    ));
    return data.claims;
  }, [persona]);

  const refreshPolicies = useCallback(async () => {
    const data = await readResponse<{ policies: PolicyVersion[] }>(await fetch("/api/policies", { cache: "no-store" }));
    setPolicies(data.policies);
    const active = data.policies.find((policy) => policy.state === "Active");
    if (active) setPolicyConfig(active.config);
  }, []);

  useEffect(() => {
    // Loading persisted state is an external synchronization, not a render-derived update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([refreshClaims(), refreshPolicies()]).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The workspace could not be loaded."))
      .finally(() => setLoading(false));
  }, [refreshClaims, refreshPolicies]);

  const visibleClaims = useMemo(() => claims.filter((claim) => persona === "reviewer" || claim.provider === "Riverside Medical Centre"), [claims, persona]);
  const selected = claims.find((claim) => claim.id === selectedId) ?? visibleClaims[0];
  const issueCount = selected?.findings.filter((finding) => finding.outcome === "issue").length ?? 0;

  useEffect(() => {
    if (!showUpload || !uploadDraftId) return;
    const timer = window.setInterval(() => {
      void refreshClaims().then((latest) => {
        const extracted = latest.find((claim) => claim.id === uploadDraftId)?.evidence.flatMap((doc) => Object.entries(doc.extractedFields)).reduce<Record<string,string>>((all,[key,value]) => ({ ...all, [key]: value }), {});
        if (extracted && Object.keys(extracted).length && prefilledDraftId !== uploadDraftId) {
          setUploadFields((current) => ({ ...current, ...extracted }));
          setPrefilledDraftId(uploadDraftId);
        }
      }).catch(() => undefined);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [showUpload, uploadDraftId, prefilledDraftId, refreshClaims]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3600); }
  async function runAction(action: "request_correction" | "reject" | "approve" | "resubmit") {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const result = await readResponse<{ status: ClaimStatus }>(await fetch(`/api/claims/${selected.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: reviewNote, actor: persona === "provider" ? "Provider billing" : "Claims reviewer" }) }));
      await refreshClaims();
      notify(`${selected.id} · ${result.status}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this claim."); }
    finally { setBusy(false); }
  }

  function changePersona(next: Persona) {
    setPersona(next); setView("claims");
    const nextClaim = next === "provider" ? claims.find((claim) => claim.provider === "Riverside Medical Centre" && ["Needs correction", "Rejected", "Draft"].includes(claim.status)) : claims.find((claim) => ["Submitted", "Resubmitted"].includes(claim.status));
    if (nextClaim) setSelectedId(nextClaim.id);
  }

  function openUpload() {
    setUploadTarget("new"); setUploadDraftId(""); setPrefilledDraftId(""); setUploadKind("Signed claim form"); setUploadFile(null); setUploadFields({ ...blankClaim, serviceDate: today }); setShowUpload(true);
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!uploadFile) { setError("Choose a PDF document first."); return; }
    setBusy(true); setError("");
    try {
      let claimId = uploadTarget === "new" ? uploadDraftId : uploadTarget;
      if (uploadTarget === "new" && !claimId) {
        claimId = (await readResponse<{ id: string }>(await fetch("/api/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...uploadFields, amount: Number(uploadFields.amount), status: "Draft", note: "Scan uploaded · confirm extracted details before submission." }) }))).id;
        setUploadDraftId(claimId);
      }
      const form = new FormData(); form.set("file", uploadFile); form.set("kind", uploadKind);
      await readResponse<{ id: string }>(await fetch(`/api/claims/${claimId}/documents`, { method: "POST", body: form }));
      setSelectedId(claimId); setUploadFile(null);
      const latest = await refreshClaims();
      const extracted = latest.find((claim) => claim.id === claimId)?.evidence.at(-1)?.extractedFields;
      if (extracted) setUploadFields((value) => ({ ...value, ...extracted }));
      notify("PDF stored privately · extraction started · verify all fields against the signed form");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function submitUploadedClaim() {
    if (!uploadDraftId) return;
    setBusy(true); setError("");
    try {
      const result = await readResponse<{ status: ClaimStatus }>(await fetch(`/api/claims/${uploadDraftId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", claim: { ...uploadFields, amount: Number(uploadFields.amount) } }) }));
      await refreshClaims(); setShowUpload(false); setSelectedId(uploadDraftId); notify(`Claim submitted · ${result.status}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit claim."); }
    finally { setBusy(false); }
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await readResponse<{ id: string }>(await fetch("/api/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...claimForm, amount: Number(claimForm.amount), status: "Draft" }) }));
      const submitted = await readResponse<{ status: ClaimStatus }>(await fetch(`/api/claims/${created.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", claim: { ...claimForm, amount: Number(claimForm.amount) } }) }));
      await refreshClaims(); setPersona("reviewer"); setSelectedId(created.id); setShowNew(false); notify(`Claim submitted · ${submitted.status}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit the claim."); }
    finally { setBusy(false); }
  }

  async function handleInstantSampleScan() {
    setBusy(true); setError("");
    try {
      const result = await readResponse<{ id: string }>(await fetch("/api/sample-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member: "Grace Wanjiku", provider: "Riverside Medical Centre", policy: "Afya Comprehensive", service: "Outpatient consultation", serviceDate: today, amount: 6200 }) }));
      await refreshClaims(); setShowUpload(false); setSelectedId(result.id); notify("Preloaded scan extracted instantly · provider confirmation is recorded in the activity");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sample scan failed."); }
    finally { setBusy(false); }
  }

  async function savePolicyDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await readResponse<{ policy: PolicyVersion }>(await fetch("/api/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...policyConfig, effectiveFrom: policyEffectiveFrom }) }));
      await refreshPolicies(); notify(`Draft ${result.policy.version} saved · not published`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save policy draft."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className={styles.loading}><span className={styles.brandMark}>C</span><p>Opening the Claimwise workspace…</p></main>;

  return <main className={styles.app}>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="Claimwise home"><span className={styles.brandMark}>C</span><span>claimwise<span className={styles.brandDot}>.</span><small>HEALTH CLAIMS</small></span></Link>
        <div className={styles.orgCard}><span className={styles.orgMark}>{persona === "provider" ? "R" : "H"}</span><span><small>ACTIVE ORGANIZATION</small><strong>{persona === "provider" ? "Riverside Medical Centre" : "Harbor Health Assurance"}</strong></span><b>⌄</b></div>
        <nav className={styles.sideNav} aria-label="Demo workspaces"><p>WORKSPACES</p>
          <button className={persona === "provider" ? styles.navActive : ""} onClick={() => changePersona("provider")}><span>▤</span><span>Provider claims</span><b>{claims.filter((claim) => claim.provider === "Riverside Medical Centre").length}</b></button>
          <button className={persona === "reviewer" ? styles.navActive : ""} onClick={() => changePersona("reviewer")}><span>✓</span><span>Claims review</span><b>{claims.filter((claim) => ["Submitted", "Resubmitted"].includes(claim.status)).length}</b></button>
          {persona === "reviewer" && <button className={view === "policies" ? styles.navActive : ""} onClick={() => setView("policies")}><span>◇</span><span>Policy & rules</span></button>}
        </nav>
        <div className={styles.sideUser}><span className={styles.userAvatar}>{persona === "provider" ? "FN" : "DK"}</span><span><strong>{persona === "provider" ? "Faith Njeri" : "Daniel Karanja"}</strong><small>{persona === "provider" ? "Provider billing" : "Claims reviewer"}</small></span><b>···</b></div>
      </aside>
      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumbs}><Link href="/">Claimwise</Link><span>/</span><strong>{persona === "provider" ? "Provider billing" : "Claims review"}</strong></div>
          <span className={styles.environment}><i /> Investor preview</span>
        </header>

        <div className={styles.content}>

      <div className={styles.headingRow}>
        <div><p className={styles.eyebrow}>{persona === "provider" ? "PROVIDER BILLING" : "INSURER & TPA"} <span>·</span> HEALTH CLAIMS</p><h1>{persona === "provider" ? "Provider claims" : view === "policies" ? "Policy & rules" : "Claims review"}</h1><p className={styles.subtitle}>{persona === "provider" ? "Submit signed claims, follow review and respond to requests." : "Assess claims against the rule version and evidence in force."}</p></div>
        <div className={styles.headingActions}>{persona === "provider" ? <><button className={styles.buttonPrimary} onClick={openUpload}><span>↑</span> Upload claim</button><button className={styles.buttonSecondary} onClick={() => { setClaimForm({ ...blankClaim, serviceDate: today }); setShowNew(true); }}>New claim</button></> : <button className={styles.buttonSecondary} onClick={() => void refreshClaims()}>↻ Refresh queue</button>}</div>
      </div>

      {persona === "reviewer" && <nav className={styles.viewTabs} aria-label="Review workspace sections"><button className={view === "claims" ? styles.viewActive : ""} onClick={() => setView("claims")}>Review queue <span>{visibleClaims.length}</span></button><button className={view === "policies" ? styles.viewActive : ""} onClick={() => setView("policies")}>Policy versions <span>{policies.length}</span></button></nav>}

      {error && <div className={styles.errorBanner} role="alert"><span>!</span><p>{error}</p><button onClick={() => setError("")} aria-label="Dismiss message">×</button></div>}

      {view === "policies" && persona === "reviewer" ? <section className={styles.policyLayout}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Policy version history</h2><p>Applicable version is selected by service date. Drafts are not published.</p></div><span className={styles.softTag}>INSURER SAMPLE</span></div>
          <div className={styles.versionList}>{policies.map((policy) => <article className={styles.versionCard} key={policy.id}><div className={styles.versionHead}><span className={styles.versionGlyph}>{policy.state === "Active" ? "✓" : "◇"}</span><div><strong>{policy.name} <span>v{policy.version}</span></strong><small>Effective {displayDate(policy.effectiveFrom)} · {policy.createdAt.slice(0,10)}</small></div><span className={`${styles.stateTag} ${policy.state === "Active" ? styles.stateActive : styles.stateDraft}`}>{policy.state}</span></div><div className={styles.ruleChips}><span>Outpatient {money(policy.config.outpatientLimit)}</span><span>Annual {money(policy.config.annualLimit)}</span><span>Co-pay {policy.config.copayPercent}%</span><span>Preauth {money(policy.config.authorizationThreshold)}</span></div><p className={styles.versionCaption}>This sample configuration is illustrative and has not been approved by an insurer.</p></article>)}</div>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Create a draft version</h2><p>Adjust typed rule parameters and save a traceable draft.</p></div></div>
          <form className={styles.policyForm} onSubmit={savePolicyDraft}>
            <NumberField label="Outpatient benefit limit (KES)" value={policyConfig.outpatientLimit} onChange={(v) => setPolicyConfig((c) => ({ ...c, outpatientLimit: v }))} />
            <NumberField label="Annual benefit limit (KES)" value={policyConfig.annualLimit} onChange={(v) => setPolicyConfig((c) => ({ ...c, annualLimit: v }))} />
            <NumberField label="Member co-pay (%)" value={policyConfig.copayPercent} onChange={(v) => setPolicyConfig((c) => ({ ...c, copayPercent: v }))} />
            <NumberField label="Pre-authorization threshold (KES)" value={policyConfig.authorizationThreshold} onChange={(v) => setPolicyConfig((c) => ({ ...c, authorizationThreshold: v }))} />
            <label className={styles.formLabel}>Draft effective from<input type="date" required value={policyEffectiveFrom} onChange={(e)=>setPolicyEffectiveFrom(e.target.value)}/></label>
            <button className={styles.buttonPrimary} disabled={busy}>Save draft version <span>→</span></button>
            <p className={styles.governanceNote}><b>Publication is disabled in this MVP.</b> Production requires an independent insurer-authorized approver; a TPA cannot publish without scoped insurer delegation.</p>
          </form>
        </div>
      </section> : <>
        <section className={styles.summaryCards}>
          <Summary title={persona === "provider" ? "My open claims" : "Awaiting review"} value={visibleClaims.filter((c) => ["Submitted","Resubmitted","Needs correction"].includes(c.status)).length.toString().padStart(2,"0")} note="Across current workflow" icon="▤" />
          <Summary title={persona === "provider" ? "Needs my attention" : "Clarification requests"} value={visibleClaims.filter((c) => c.status === "Needs correction").length.toString().padStart(2,"0")} note="Next action is clearly identified" icon="!" tone="amber" />
          <Summary title="Approved this period" value={visibleClaims.filter((c)=>c.status==="Approved").length.toString().padStart(2,"0")} note="Claims approved by review" icon="✓" tone="green" />
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>{persona === "provider" ? "Riverside facility claims" : "Review & approval queue"}</h2><p>{persona === "provider" ? "Your submissions and reviewer requests." : "All submitted and resubmitted provider claims."}</p></div><button className={styles.iconButton} onClick={() => void refreshClaims()} aria-label="Refresh claims">↻</button></div>
            <div className={styles.claimList}>{visibleClaims.map((claim) => <button key={claim.id} onClick={() => setSelectedId(claim.id)} className={`${styles.claimRow} ${claim.id === selected?.id ? styles.claimSelected : ""}`}><span className={styles.claimAvatar}>{claim.member.split(" ").map(p=>p[0]).join("")}</span><span className={styles.claimSummary}><strong>{claim.member}</strong><small>{claim.provider} · {claim.id}</small><small>{claim.service} · {displayDate(claim.serviceDate)}</small></span><span className={`${styles.status} ${styles[statusClass(claim.status)]}`}>{claim.status}</span><b className={styles.claimAmount}>{money(claim.amount)}</b><span className={styles.chevron}>›</span></button>)}{!visibleClaims.length && <div className={styles.emptyState}>No claims in this workspace yet.</div>}</div>
            <div className={styles.listFoot}>Showing {visibleClaims.length} claim{visibleClaims.length===1?"":"s"} <span>·</span> {persona === "provider" ? "Submitted to Harbor Health Assurance" : "Across contracted providers"}</div>
          </div>

          {selected ? <aside className={styles.detailPanel}>
            <div className={styles.detailMeta}><span className={styles.claimId}>{selected.id} <i>·</i> VERSION {selected.version}</span><span className={`${styles.status} ${styles[statusClass(selected.status)]}`}>{selected.status}</span></div>
            <div className={styles.patientHeading}><span className={styles.largeAvatar}>{selected.member.split(" ").map(p=>p[0]).join("")}</span><div><h2>{selected.member}</h2><p>{selected.service} <span>·</span> {displayDate(selected.serviceDate)}</p></div></div>
            <div className={styles.providerStrip}><span className={styles.providerMark}>+</span><span><small>HEALTH FACILITY</small><strong>{selected.provider}</strong></span><span className={styles.contractPill}>Contracted</span></div>
            <div className={styles.claimFacts}><div><span>Policy</span><b>{selected.policy} · v{selected.policyVersion}</b></div><div><span>Claimed</span><b>{money(selected.amount)}</b></div><div><span>Service date</span><b>{displayDate(selected.serviceDate)}</b></div><div><span>Approved payable</span><b>{selected.payableAmount == null ? "Pending review" : money(selected.payableAmount)}</b>{selected.approvedClaimVersion != null && <small>For claim version {selected.approvedClaimVersion}</small>}</div></div>

            <section className={styles.detailSection}>
              <div className={styles.sectionHeading}><div><h3>Rule assessment</h3><p className={styles.assessmentCaption}>Policy v{selected.policyVersion} · each finding links to its rule and evidence.</p></div><span className={styles.assessmentCount}>{selected.findings.filter((finding) => finding.outcome !== "pass").length} needs attention</span></div>
              <div className={styles.findingList}>{selected.findings.filter((finding) => showPassedRules || finding.outcome !== "pass").map((finding) => <article key={finding.id} className={`${styles.finding} ${styles[`finding${finding.outcome}`]}`}><span className={styles.findingIcon}>{finding.outcome === "pass" ? "✓" : finding.outcome === "issue" ? "!" : "·"}</span><div><div className={styles.findingTitle}><strong>{finding.title}</strong><span>{finding.code} · v{finding.ruleVersion}</span></div><p>{finding.message}</p><small>Source: {finding.sourceClause} <span>·</span> Evidence: {finding.evidence}</small></div></article>)}</div>
              {selected.findings.some((finding) => finding.outcome === "pass") && <button className={styles.showRules} aria-expanded={showPassedRules} onClick={() => setShowPassedRules((open) => !open)}>{showPassedRules ? "Hide" : "Show"} {selected.findings.filter((finding) => finding.outcome === "pass").length} checks passed <span>{showPassedRules ? "−" : "+"}</span></button>}
            </section>

            <section className={styles.detailSection}><div className={styles.sectionHeading}><h3>Claim documents</h3><button onClick={openUpload} className={styles.textButton}>＋ Add document</button></div>{selected.evidence.length ? <div className={styles.documentList}>{selected.evidence.map((doc) => <article key={doc.id} className={styles.documentRow}><span className={styles.pdfIcon}>PDF</span><span className={styles.documentInfo}><strong>{doc.name}</strong><small>{doc.kind} <span>·</span> {doc.extractionStatus} {doc.size ? `· ${(doc.size/1024).toFixed(0)} KB` : ""}</small>{doc.extractedText && <details><summary>Extraction / evidence text</summary><pre>{doc.extractedText}</pre></details>}</span>{doc.downloadUrl && <a className={styles.documentLink} href={doc.downloadUrl} target="_blank" rel="noreferrer" aria-label={`Open ${doc.name}`}>↗</a>}</article>)}</div> : <div className={styles.emptyDocuments}>No documents attached. Upload a signed claim form and itemized receipt.</div>}</section>

            <section className={styles.detailSection}><div className={styles.sectionHeading}><h3>Claim history</h3><span>{selected.activity.length} EVENTS</span></div><div className={styles.timeline}>{selected.activity.slice().reverse().map((event)=><div className={styles.timelineRow} key={event.id}><span className={styles.timelineDot}/><div><strong>{event.message}</strong><small>{event.actor} <span>·</span> {new Date(event.at).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"})}</small></div></div>)}</div></section>

            <div className={styles.actionArea}>
              {persona === "provider" && ["Needs correction","Rejected"].includes(selected.status) && <><label htmlFor="provider-response">Provider response</label><textarea id="provider-response" value={reviewNote} onChange={(e)=>setReviewNote(e.target.value)} placeholder="Describe the correction and evidence added…"/><button className={styles.buttonPrimary} disabled={busy} onClick={()=>void runAction("resubmit")}>Resubmit this version <span>→</span></button></>}
              {persona === "reviewer" && ["Submitted","Resubmitted"].includes(selected.status) && <><label htmlFor="review-note">Decision note</label><textarea id="review-note" value={reviewNote} onChange={(e)=>setReviewNote(e.target.value)} placeholder="Explain the decision or request…"/><div className={styles.reviewActions}><button className={styles.buttonSecondary} disabled={busy} onClick={()=>void runAction("request_correction")}>Request correction</button><button className={styles.buttonDanger} disabled={busy} onClick={()=>void runAction("reject")}>Reject</button><button className={styles.buttonPrimary} disabled={busy||issueCount>0} title={issueCount ? "Resolve blocking findings before approval" : "Approve claim"} onClick={()=>void runAction("approve")}>Approve claim <span>→</span></button></div>{issueCount>0&&<p className={styles.blockingHint}>Resolve {issueCount} blocking rule finding{issueCount===1?"":"s"} before approval.</p>}</>}
              {!((persona==="provider"&&["Needs correction","Rejected"].includes(selected.status))||(persona==="reviewer"&&["Submitted","Resubmitted"].includes(selected.status)))&&<p className={styles.noAction}>No action is available for this persona at the current stage.</p>}
            </div>
          </aside> : <aside className={styles.detailPanel}><div className={styles.emptyState}>Select a claim to inspect its rule assessment and evidence.</div></aside>}
        </section>
      </>}
      <footer className={styles.footer}><span>CLAIMWISE HEALTH</span><span>Investor preview · sample claim records</span></footer>
        </div>
      </div>
    </div>

    {showNew && <div className={styles.backdrop} role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowNew(false);}}><form className={styles.modal} onSubmit={submitManual}><div className={styles.modalHeader}><div><p className={styles.eyebrow}>MANUAL FALLBACK</p><h2>Create a claim</h2></div><button type="button" onClick={()=>setShowNew(false)} className={styles.closeButton} aria-label="Close">×</button></div><ClaimFields value={claimForm} onChange={setClaimForm}/><p className={styles.modalNote}>Enter details from the signed insurer form, attach the form and invoice after creation, then confirm submission.</p><div className={styles.modalActions}><button type="button" className={styles.buttonSecondary} onClick={()=>setShowNew(false)}>Cancel</button><button className={styles.buttonPrimary} disabled={busy}>Create & assess <span>→</span></button></div></form></div>}

    {showUpload && <div className={styles.backdrop} role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowUpload(false);}}><section className={styles.modal}><div className={styles.modalHeader}><div><p className={styles.eyebrow}>SCAN-FIRST INTAKE</p><h2>Upload Claim</h2><p className={styles.modalSubtitle}>Attach the signed insurer form or supporting evidence.</p></div><button type="button" onClick={()=>setShowUpload(false)} className={styles.closeButton} aria-label="Close">×</button></div>
      {!uploadDraftId && <label className={styles.formLabel}>Attach to<select value={uploadTarget} onChange={(e)=>setUploadTarget(e.target.value)}><option value="new">Start a new claim from scan</option>{visibleClaims.map(claim=><option key={claim.id} value={claim.id}>{claim.id} · {claim.member}</option>)}</select></label>}
      {uploadTarget==="new" && <ClaimFields value={uploadFields} onChange={setUploadFields}/>}
      {uploadDraftId && <div className={styles.draftNotice}>Draft {uploadDraftId} · verify the extracted fields below and attach any remaining documents.</div>}
      <form className={styles.uploadForm} onSubmit={uploadDocument}><label className={styles.formLabel}>Document type<select value={uploadKind} onChange={(e)=>setUploadKind(e.target.value as DocumentKind)}>{documentKinds.map(kind=><option key={kind}>{kind}</option>)}</select></label><label className={styles.fileDrop}><span className={styles.uploadSymbol}>↑</span><strong>{uploadFile?.name ?? "Choose a signed claim or evidence PDF"}</strong><small>PDF only · maximum 20 MB per file</small><input key={uploadFile?.name ?? "no-file"} type="file" accept="application/pdf,.pdf" onChange={(e)=>setUploadFile(e.target.files?.[0]??null)}/></label><button className={styles.buttonSecondary} disabled={busy||!uploadFile}>{busy?"Uploading…":"Upload & extract"}</button></form>
      <div className={styles.ocrNotice}><b>Extraction is a draft, not a decision.</b> Text is extracted locally when the required tools are installed. Handwriting and low-confidence fields need manual transcription and confirmation.</div>
      {uploadDraftId && <div className={styles.modalActions}><button className={styles.buttonPrimary} disabled={busy||!uploadFields.member||!uploadFields.service||!uploadFields.amount} onClick={()=>void submitUploadedClaim()}>Confirm details & submit <span>→</span></button></div>}
      {!uploadDraftId && <button className={styles.sampleButton} disabled={busy} onClick={()=>void handleInstantSampleScan()}>✦ Use instant reference scan <span>Preloaded fields · no OCR wait</span></button>}
      </section></div>}

    {toast && <div className={styles.toast} role="status"><span>✓</span>{toast}</div>}
  </main>;
}

function ClaimFields({ value, onChange }: { value: ClaimForm; onChange: (value: ClaimForm) => void }) {
  const field = (key: keyof ClaimForm, next: string) => onChange({ ...value, [key]: next });
  return <div className={styles.fieldsGrid}>
    <label className={styles.formLabel}>Member<select required value={value.member} onChange={(e)=>field("member",e.target.value)}><option value="">Choose a member</option>{members.map((member)=><option key={member}>{member}</option>)}</select></label>
    <label className={styles.formLabel}>Health facility<select required value={value.provider} onChange={(e)=>field("provider",e.target.value)}>{providers.map((provider)=><option key={provider}>{provider}</option>)}</select></label>
    <label className={styles.formLabel}>Policy<select required value={value.policy} onChange={(e)=>field("policy",e.target.value)}><option>Afya Comprehensive</option></select></label>
    <label className={styles.formLabel}>Service date<input required type="date" value={value.serviceDate} onChange={(e)=>field("serviceDate",e.target.value)}/></label>
    <label className={`${styles.formLabel} ${styles.fullWidth}`}>Service / procedure<input required value={value.service} onChange={(e)=>field("service",e.target.value)} placeholder="e.g. Outpatient consultation"/></label>
    <label className={styles.formLabel}>Claim amount (KES)<input required type="number" min="1" step="1" value={value.amount} onChange={(e)=>field("amount",e.target.value)} placeholder="Enter total"/></label>
  </div>;
}

function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <label className={styles.formLabel}>{label}<input type="number" min="0" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></label>; }
function Summary({title,value,note,icon,tone="green"}:{title:string;value:string;note:string;icon:string;tone?:"green"|"amber"|"blue"}) { return <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles[`tone${tone}`]}`}>{icon}</span><div><small>{title}</small><strong>{value}</strong><span>{note}</span></div></article>; }
