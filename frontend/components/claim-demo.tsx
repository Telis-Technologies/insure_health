"use client";

import { useMemo, useState } from "react";
import styles from "./claim-demo.module.css";
import workspaceStyles from "./claim-demo-workspace.module.css";
import navigationStyles from "./claim-demo-navigation.module.css";

type Stage = "Submitted" | "Needs information" | "Ready for approval" | "Approved for payment" | "Paid";
type Role = "Provider" | "Claims reviewer" | "Finance";
type Evidence = { name: string; category: string; size: number; mime: string; url?: string };
type Claim = { id: string; member: string; provider: string; service: string; amount: number; date: string; stage: Stage; note: string; history: string[]; evidence: Evidence[] };

const initialClaims: Claim[] = [
  { id: "CLM-1048", member: "Daniel Mwangi", provider: "Riverside Medical Centre", service: "MRI brain + consultation", amount: 36100, date: "14 Oct 2026", stage: "Needs information", note: "Please attach the radiologist report to support the MRI line.", history: ["Claim submitted by Riverside Medical Centre", "TPA requested radiologist report"], evidence: [{ name: "Invoice_CLM-1048.pdf", category: "Itemized invoice", size: 248000, mime: "application/pdf" }] },
  { id: "CLM-1047", member: "Amina Otieno", provider: "Kilimani Family Clinic", service: "Outpatient consultation", amount: 4800, date: "14 Oct 2026", stage: "Submitted", note: "Routine outpatient claim · no authorization required.", history: ["Claim submitted by Kilimani Family Clinic"], evidence: [{ name: "Consultation_notes.pdf", category: "Clinical notes", size: 182000, mime: "application/pdf" }, { name: "Invoice_CLM-1047.pdf", category: "Itemized invoice", size: 99000, mime: "application/pdf" }] },
  { id: "CLM-1046", member: "Wanjiku Wambui", provider: "Westlands Community Hospital", service: "Maternity admission", amount: 84000, date: "13 Oct 2026", stage: "Ready for approval", note: "Eligibility confirmed · authorization AUTH-8821 · within benefit limit.", history: ["Claim submitted", "TPA review complete · recommended for approval"], evidence: [{ name: "AUTH-8821.pdf", category: "Pre-authorization", size: 156000, mime: "application/pdf" }, { name: "Discharge_summary.pdf", category: "Discharge summary", size: 328000, mime: "application/pdf" }] },
  { id: "CLM-1045", member: "Brian Kiptoo", provider: "Parklands Specialist Centre", service: "Specialist consultation", amount: 12600, date: "13 Oct 2026", stage: "Approved for payment", note: "Approved payable KES 10,800 after tariff adjustment.", history: ["Claim submitted", "Approved by insurer · payable KES 10,800"], evidence: [{ name: "Specialist_report.pdf", category: "Clinical notes", size: 214000, mime: "application/pdf" }] },
  { id: "CLM-1044", member: "Mercy Njeri", provider: "Thika Road Medical Centre", service: "Diagnostics", amount: 9400, date: "12 Oct 2026", stage: "Paid", note: "KES 6,900 settled · receipt matched.", history: ["Claim submitted", "Approved · KES 6,900", "Payment recorded · receipt matched"], evidence: [{ name: "Lab_results.pdf", category: "Investigation results", size: 115000, mime: "application/pdf" }] },
];

const money = (value: number) => `KES ${new Intl.NumberFormat("en-KE").format(value)}`;
const roleTabs: { role: Role; title: string; subtitle: string; stages: Stage[] }[] = [
  { role: "Provider", title: "Provider billing", subtitle: "Submit claims and respond to information requests.", stages: ["Needs information", "Submitted", "Approved for payment", "Paid"] },
  { role: "Claims reviewer", title: "Claims review", subtitle: "Review evidence, request corrections, recommend, and approve claims.", stages: ["Submitted", "Needs information", "Ready for approval", "Approved for payment"] },
  { role: "Finance", title: "Finance & settlement", subtitle: "Record insurer payments and reconcile settled claims.", stages: ["Approved for payment", "Paid"] },
];

export function ClaimDemo() {
  const [claims, setClaims] = useState(initialClaims);
  const [selectedId, setSelectedId] = useState(initialClaims[1].id);
  const [role, setRole] = useState<Role>("Claims reviewer");
  const [toast, setToast] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("All claims");
  const [newAmount, setNewAmount] = useState("6200");
  const [newMember, setNewMember] = useState("Grace Wanjiku");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadClaimId, setUploadClaimId] = useState(initialClaims[1].id);
  const [uploadCategory, setUploadCategory] = useState("Clinical notes");

  const selected = claims.find((claim) => claim.id === selectedId) ?? claims[0];
  const activeTab = roleTabs.find((tab) => tab.role === role)!;
  const visibleClaims = useMemo(() => claims.filter((claim) => activeTab.stages.includes(claim.stage) && (filter === "All claims" || claim.stage === filter)), [claims, activeTab, filter]);

  function updateClaim(nextStage: Stage, message: string) {
    setClaims((items) => items.map((claim) => claim.id === selected.id ? { ...claim, stage: nextStage, history: [...claim.history, message], note: message } : claim));
    setToast(`${selected.id} · ${message}`);
    window.setTimeout(() => setToast(""), 3200);
  }

  function selectRole(nextRole: Role) {
    setRole(nextRole);
    setFilter("All claims");
    const firstRelevantClaim = claims.find((claim) => roleTabs.find((tab) => tab.role === nextRole)!.stages.includes(claim.stage));
    if (firstRelevantClaim) setSelectedId(firstRelevantClaim.id);
  }

  function addEvidence(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setToast("File is larger than 10 MB. Choose a smaller document.");
      event.target.value = "";
      return;
    }
    if (file.type && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setToast("Unsupported file type. Upload a PDF, JPG, or PNG document.");
      event.target.value = "";
      return;
    }
    const evidence: Evidence = { name: file.name, category: uploadCategory, size: file.size, mime: file.type || "application/octet-stream", url: URL.createObjectURL(file) };
    setClaims((items) => items.map((claim) => claim.id === uploadClaimId ? { ...claim, evidence: [...claim.evidence, evidence], history: [...claim.history, `Evidence uploaded · ${file.name} (${uploadCategory})`] } : claim));
    setSelectedId(uploadClaimId);
    setToast(`${file.name} attached to ${uploadClaimId}`);
    event.target.value = "";
  }

  function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = `CLM-${1049 + claims.length - initialClaims.length}`;
    const claim: Claim = { id, member: newMember, provider: "Riverside Medical Centre", service: "Outpatient consultation", amount: Number(newAmount), date: "14 Oct 2026", stage: "Submitted", note: "New provider claim · eligibility check passed.", history: ["Claim created and submitted · eligibility check passed"], evidence: [] };
    setClaims((items) => [claim, ...items]);
    setSelectedId(id);
    setFilter("All claims");
    setShowNew(false);
    setRole("Claims reviewer");
    setToast(`${id} submitted · ready for claims review`);
  }

  return <main className={styles.app}>
    <header className={styles.header}>
      <a className={styles.brand} href="#"><span className={styles.logo}>C</span><span>claimwise<span className={styles.dot}>.</span><small>HEALTH CLAIMS</small></span></a>
      <div className={styles.headerCenter}><span className={styles.liveDot} /> Live claim workflow <span className={styles.headerDivider}>/</span> Harbor Health Assurance</div>
      <span className={styles.demoLabel}>WORKSPACE</span>
    </header>

    <nav className={styles.roleTabs} aria-label="Demo workspace">{roleTabs.map((tab) => <button key={tab.role} className={`${styles.roleTab} ${role === tab.role ? styles.activeRoleTab : ""}`} aria-current={role === tab.role ? "page" : undefined} onClick={() => selectRole(tab.role)}><span className={styles.roleIcon}>{tab.role === "Provider" ? "＋" : tab.role === "Claims reviewer" ? "✓" : "↗"}</span><span><strong>{tab.title}</strong><small>{tab.role === "Provider" ? "Health facility" : tab.role === "Claims reviewer" ? "TPA + insurer" : "Settlement"}</small></span></button>)}</nav>

    <section className={styles.intro}><div><p className={styles.eyebrow}>{activeTab.title.toUpperCase()} · HEALTH CLAIMS</p><h1>{activeTab.title}</h1><p className={styles.subtitle}>{activeTab.subtitle}</p></div>{role === "Provider" && <div className={navigationStyles.introActions}><button className={`${styles.secondaryButton} ${navigationStyles.topUploadButton}`} onClick={() => { setUploadClaimId(selected.id); setShowUpload(true); }}>↑ <span>Upload Claim</span></button><button className={styles.primaryButton} onClick={() => setShowNew(true)}>＋ <span>New claim</span></button></div>}</section>

    <section className={styles.metrics} aria-label="Claim totals">
      <article><span>Open claims</span><strong>{claims.filter((claim) => claim.stage !== "Paid").length.toString().padStart(2, "0")}</strong><small>Across all review stages</small></article>
      <article><span>Needs attention</span><strong>{claims.filter((claim) => claim.stage === "Needs information").length.toString().padStart(2, "0")}</strong><small>Waiting on provider response</small></article>
      <article><span>Ready to settle</span><strong>{claims.filter((claim) => claim.stage === "Approved for payment").length.toString().padStart(2, "0")}</strong><small>Approved by the insurer</small></article>
      <article className={styles.metricValue}><span>Approved payable</span><strong>{money(claims.filter((claim) => ["Approved for payment", "Paid"].includes(claim.stage)).reduce((sum, claim) => sum + Math.round(claim.amount * .9), 0))}</strong><small>Payment recorded after approval</small></article>
    </section>

    <section className={styles.workflow} aria-label={`${activeTab.title} workflow`}>
      {activeTab.stages.map((stage, index) => <button key={stage} className={`${styles.workflowStep} ${selected.stage === stage ? styles.currentStep : ""}`} onClick={() => setFilter(stage)}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><span>{stage}</span><b>{claims.filter((claim) => claim.stage === stage).length}</b></button>)}
    </section>

    <section className={styles.workspace}>
      <div className={styles.claimPanel}>
        <div className={styles.panelHeading}><div><h2>{role === "Provider" ? "My facility claims" : role === "Claims reviewer" ? "Review & approval queue" : "Payment queue"}</h2><p>{role === "Provider" ? "Track submissions and respond to reviewer requests." : role === "Claims reviewer" ? "Review submitted claims, then approve those ready for insurer decision." : "Approved claims ready for settlement or already paid."}</p></div><select aria-label="Filter claims" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All claims</option>{activeTab.stages.map((stage) => <option key={stage}>{stage}</option>)}</select></div>
        <div className={styles.claimList}>{visibleClaims.map((claim) => <button key={claim.id} onClick={() => setSelectedId(claim.id)} className={`${styles.claimRow} ${selected.id === claim.id ? styles.selectedRow : ""}`}><span className={styles.claimInitial}>{claim.member.split(" ").map((part) => part[0]).join("")}</span><span className={styles.claimMain}><strong>{claim.member}</strong><small>{claim.provider} · {claim.id}</small></span><span className={`${styles.status} ${styles[`status${claim.stage.replaceAll(" ", "")}`]}`}>{claim.stage}</span><strong className={styles.claimAmount}>{money(claim.amount)}</strong><span className={styles.rowArrow}>›</span></button>)}</div>
        <div className={styles.listFooter}>Showing {visibleClaims.length} of {claims.length} claims <span>·</span> Updated just now</div>
      </div>

      <aside className={styles.detailPanel}>
        <div className={styles.detailTop}><div><span className={styles.caseId}>{selected.id}</span><span className={`${styles.status} ${styles[`status${selected.stage.replaceAll(" ", "")}`]}`}>{selected.stage}</span></div><button className={styles.moreButton} aria-label="More claim actions">···</button></div>
        <h2>{selected.member}</h2><p className={styles.detailSubtitle}>{selected.service} <span>·</span> {selected.date}</p>
        <div className={styles.providerCard}><span className={styles.providerIcon}>+</span><span><small>HEALTH FACILITY</small><strong>{selected.provider}</strong></span><span className={styles.verified}>✓ Contracted</span></div>
        <div className={styles.amountCard}><span>Claimed amount</span><strong>{money(selected.amount)}</strong><div><span>Estimated eligible</span><b>{money(Math.round(selected.amount * .9))}</b></div><div><span>Member share</span><b>{money(Math.round(selected.amount * .1))}</b></div></div>
        <div className={styles.assessment}><div className={styles.sectionTitle}><h3>Review notes</h3><span>POLICY · V3.2</span></div><p>{selected.note}</p><div className={styles.rule}><span>✓</span><div><strong>Eligibility confirmed</strong><small>Member active · Afya Comprehensive · service date covered</small></div></div><div className={styles.rule}><span>✓</span><div><strong>Tariff checked</strong><small>Contracted rate applied · 10% member co-pay</small></div></div></div>
        <div className={workspaceStyles.detailEvidence}><div className={styles.sectionTitle}><h3>Evidence</h3><button onClick={() => { setUploadClaimId(selected.id); setShowUpload(true); }} className={workspaceStyles.addEvidenceButton}>＋ Add evidence</button></div>{selected.evidence.length ? selected.evidence.map((item, index) => <div className={workspaceStyles.detailEvidenceRow} key={`${item.name}-${index}`}><span className={workspaceStyles.evidenceCheck}>✓</span><span><strong>{item.name}</strong><small>{item.category}{item.url ? ` · ${(item.size / 1024).toFixed(0)} KB` : " · On file"}</small></span>{item.url && <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.name}`}>↗</a>}</div>) : <p className={workspaceStyles.noEvidence}>No documents attached to this claim.</p>}</div>
        <div className={styles.activity}><div className={styles.sectionTitle}><h3>Activity</h3><span>{selected.history.length} EVENTS</span></div>{selected.history.map((item, index) => <div className={styles.activityRow} key={`${item}-${index}`}><span className={styles.activityDot} /><div><strong>{item}</strong><small>{index === 0 ? selected.date : "Today · just now"}</small></div></div>)}</div>
        <div className={styles.actions}>{role === "Provider" && selected.stage === "Needs information" && <button className={styles.primaryButton} onClick={() => { setUploadClaimId(selected.id); setShowUpload(true); }}>Upload requested evidence <span>→</span></button>}{role === "Provider" && selected.stage === "Needs information" && <button className={styles.secondaryButton} onClick={() => updateClaim("Submitted", "Provider response sent with requested evidence")}>Send response</button>}{role === "Claims reviewer" && selected.stage === "Submitted" && <><button className={styles.secondaryButton} onClick={() => updateClaim("Needs information", "Clarification requested · please attach clinical notes")}>Request information</button><button className={styles.primaryButton} onClick={() => updateClaim("Ready for approval", "Review complete · recommended and approved for payment")}>Approve for payment <span>→</span></button></>}{role === "Claims reviewer" && selected.stage === "Needs information" && <p className={styles.actionHint}>Waiting for provider evidence or clarification response.</p>}{role === "Claims reviewer" && selected.stage === "Ready for approval" && <button className={styles.primaryButton} onClick={() => updateClaim("Approved for payment", `Approved · payable ${money(Math.round(selected.amount * .9))}`)}>Approve claim <span>→</span></button>}{role === "Finance" && selected.stage === "Approved for payment" && <button className={styles.primaryButton} onClick={() => updateClaim("Paid", `Payment recorded · ${money(Math.round(selected.amount * .9))} receipt matched`)}>Record payment <span>→</span></button>}{!((role === "Provider" && selected.stage === "Needs information") || (role === "Claims reviewer" && ["Submitted", "Needs information", "Ready for approval"].includes(selected.stage)) || (role === "Finance" && selected.stage === "Approved for payment")) && <p className={styles.actionHint}>No action needed for {role.toLowerCase()} at this stage.</p>}</div>
      </aside>
    </section>
    <footer className={styles.footer}><span>CLAIMWISE HEALTH</span><span>Interactive local prototype · changes reset on refresh</span></footer>

    {showNew && <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowNew(false)}><form className={styles.modal} onSubmit={submitClaim} onClick={(event) => event.stopPropagation()}><div className={styles.modalHead}><div><p className={styles.eyebrow}>PROVIDER INTAKE</p><h2>Submit a claim</h2></div><button type="button" className={styles.closeButton} onClick={() => setShowNew(false)} aria-label="Close">×</button></div><label>Member<select value={newMember} onChange={(event) => setNewMember(event.target.value)}><option>Grace Wanjiku</option><option>Daniel Mwangi</option><option>Amina Otieno</option><option>Joseph Omondi</option></select></label><label>Provider<select><option>Riverside Medical Centre</option><option>Kilimani Family Clinic</option><option>Westlands Community Hospital</option></select></label><label>Policy<select><option>Afya Comprehensive · active</option><option>Afya Outpatient · active</option></select></label><label>Claim amount (KES)<input required min="1" type="number" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} /></label><div className={styles.eligibility}><span>✓</span>Member active · service date eligible · provider contracted</div><button className={styles.primaryButton} type="submit">Submit claim <span>→</span></button></form></div>}
    {showUpload && <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowUpload(false)}><section className={`${styles.modal} ${navigationStyles.uploadModal}`} role="dialog" aria-modal="true" aria-labelledby="upload-title" onClick={(event) => event.stopPropagation()}><div className={styles.modalHead}><div><p className={styles.eyebrow}>CLAIM EVIDENCE</p><h2 id="upload-title">Upload documents</h2></div><button type="button" className={styles.closeButton} onClick={() => setShowUpload(false)} aria-label="Close">×</button></div><label>Attach to claim<select value={uploadClaimId} onChange={(event) => setUploadClaimId(event.target.value)}>{claims.map((claim) => <option value={claim.id} key={claim.id}>{claim.id} · {claim.member}</option>)}</select></label><label>Evidence type<select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}><option>Clinical notes</option><option>Itemized invoice</option><option>Investigation results</option><option>Pre-authorization</option><option>Discharge summary</option><option>Referral letter</option><option>Other supporting document</option></select></label><label className={workspaceStyles.fileDrop}><span className={workspaceStyles.uploadGlyph}>↑</span><strong>Choose a document to upload</strong><small>PDF, JPG or PNG · up to 10 MB</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={addEvidence} /></label><div className={navigationStyles.modalEvidence}><strong>Attached evidence</strong>{(claims.find((claim) => claim.id === uploadClaimId)?.evidence ?? []).length ? claims.find((claim) => claim.id === uploadClaimId)!.evidence.map((item, index) => <div className={navigationStyles.modalEvidenceRow} key={`${item.name}-${index}`}><span>{item.category}</span><b>{item.name}</b>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open ↗</a>}</div>) : <p className={workspaceStyles.uploadFootnote}>No documents attached yet.</p>}</div><p className={workspaceStyles.uploadFootnote}>Files stay in this browser session and are cleared on refresh.</p></section></div>}
    {toast && <div className={styles.toast}><span>✓</span>{toast}</div>}
  </main>;
}
