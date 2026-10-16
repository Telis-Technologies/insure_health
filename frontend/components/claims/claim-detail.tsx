"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { demoProviders, kes, referenceCases } from "@/lib/demo-data";

export function ClaimDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const [selectedVersion, setSelectedVersion] = useState<"v1" | "v2">("v1");
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const claim = referenceCases.find((item) => item.fixtureId.toLowerCase() === id.toLowerCase());

  if (!claim) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CLAIMS / NOT FOUND</div>
            <h1>Claim Not Found</h1>
            <p className="page-subtitle">The requested claim reference &quot;{id}&quot; does not exist in the register.</p>
          </div>
          <Link className="button button-outline" href="/claims">
            ← Back to claims
          </Link>
        </div>
      </>
    );
  }

  // Tenant / Provider organization boundary check
  const isProvider = session?.user?.roles?.includes("provider-biller");
  const userOrgIds = session?.user?.organizationIds ?? [];
  const isAuthorizedProvider = !isProvider || demoProviders.some(
    (provider) => provider.name === claim.provider && userOrgIds.includes(provider.id)
  );

  if (!isAuthorizedProvider) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CLAIMS / ACCESS RESTRICTED</div>
            <h1>Unauthorized Claim Access</h1>
            <p className="page-subtitle">This claim belongs to {claim.provider}, which is outside your organization delegation.</p>
          </div>
          <Link className="button button-outline" href="/claims">
            ← Back to claims
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="back-row">
        <Link href="/claims">← Claims</Link>
        <span>/</span>
        <span>{claim.fixtureId}</span>
      </div>

      <div className="page-heading">
        <div>
          <div className="eyebrow">
            CLAIM DETAIL <span className="eyebrow-dot">·</span> {claim.fixtureId}
          </div>
          <h1>
            Case {claim.fixtureId.slice(-3)} · {claim.member}
          </h1>
          <p className="page-subtitle">
            {claim.provider} · {claim.policy} · Encounter Date: {claim.serviceDate}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span className="status-pill status-reference">
            <i /> {claim.status}
          </span>
          <span className="notice-tag">
            {selectedVersion === "v1" ? "VERSION 1 (IMMUTABLE)" : "VERSION 2 (CORRECTED)"}
          </span>
        </div>
      </div>

      {/* VERSION SELECTOR BAR (FR05) */}
      <div className="rules-toolbar" style={{ marginBottom: "16px" }}>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${selectedVersion === "v1" ? "active" : ""}`}
            onClick={() => setSelectedVersion("v1")}
          >
            Version 1 (Original Submitted · KES 36,100)
          </button>
          <button
            type="button"
            className={`tab ${selectedVersion === "v2" ? "active" : ""}`}
            onClick={() => setSelectedVersion("v2")}
          >
            Version 2 (Provider Corrected · KES 29,700)
          </button>
        </div>
        <span className="muted-label">
          {selectedVersion === "v1"
            ? "Submitted 23 Sep 2026 · Original bill preserved"
            : "Resubmitted 24 Sep 2026 · Deduplicated KES 6,400 correction"}
        </span>
      </div>

      {/* HERO FINANCIAL METRICS */}
      <section className="detail-hero-grid" style={{ marginBottom: "14px" }}>
        <div className="panel detail-amount-card">
          <div className="panel-kicker">
            {selectedVersion === "v1" ? "SUBMITTED BILLED TOTAL" : "ELIGIBLE AFTER CORRECTIONS"}
          </div>
          <strong>{kes(selectedVersion === "v1" ? claim.billed : claim.eligible)}</strong>
          <span>
            {claim.lines.length} bill lines · {claim.workflow}
          </span>

          <div className="detail-amount-divider" />

          <div className="hero-pairs">
            <span>Billed charges</span>
            <strong>{kes(claim.billed)}</strong>

            <span>Proposed corrections</span>
            <strong className="correction-cell">− {kes(claim.correction)}</strong>

            <span>Eligible charges</span>
            <strong style={{ color: "#276c54" }}>{kes(claim.eligible)}</strong>

            <span>Insurer payable (90%)</span>
            <strong>{kes(claim.insurerShare)}</strong>

            <span>Member share (10%)</span>
            <strong>{kes(claim.memberShare)}</strong>

            <span>Remaining outpatient benefit</span>
            <strong>{kes(claim.remainingBenefit)}</strong>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">PARTIES, CONTRACT & COVERAGE</p>
              <h2>Encounter Context</h2>
            </div>
          </div>
          <div className="context-grid">
            <ContextItem label="Member Name" value={claim.member} />
            <ContextItem label="Member ID" value="MBR-HHA-001" />
            <ContextItem label="Insurer" value={claim.insurer} />
            <ContextItem label="TPA Administrator" value={claim.tpa} />
            <ContextItem label="Provider Facility" value={claim.provider} />
            <ContextItem label="Provider Contract" value={claim.contract} />
            <ContextItem label="Policy Scheme" value={claim.policy} />
            <ContextItem label="Service Date" value={claim.serviceDate} />
            <ContextItem label="Encounter Ref" value="ENC-RMC-2026-0922" />
            <ContextItem label="Care Setting" value="Outpatient Specialist" />
            <ContextItem label="Annual Limit" value="KES 100,000" />
            <ContextItem label="Pre-Claim Available" value="KES 82,000" />
          </div>
        </div>
      </section>

      {/* PREAUTHORIZATION CARD (FR06) */}
      <section className="panel" style={{ marginBottom: "14px" }}>
        <div className="panel-header">
          <div>
            <p className="panel-kicker">PREAUTHORIZATION EVIDENCE · FR06</p>
            <h2>Linked Preauthorization: {claim.authorization}</h2>
          </div>
          <span className="status-pill status-reference">Approved Reference</span>
        </div>
        <div className="contract-grid">
          <ContextItem label="Approved Service" value="MRI brain without contrast" />
          <ContextItem label="Service Date" value={claim.serviceDate} />
          <ContextItem label="Ceiling Limit" value={kes(25000)} />
          <ContextItem label="Clinical Context" value="Persistent headaches with neurological signs" />
          <ContextItem label="Authorization Ref" value={claim.authorization} />
          <ContextItem label="Deduplication Rule" value="Tariff cap & ceiling overlap resolved (FR13)" />
        </div>
      </section>

      {/* BILL LINES TABLE */}
      <div className="two-column-stack">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">
                {selectedVersion === "v1" ? "ORIGINAL BILL LINES (V1)" : "CORRECTED BILL LINES (V2)"}
              </p>
              <h2>Itemized Claim Services & Adjustments</h2>
            </div>
            <span className="notice-tag">6 LINES</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Service & Clinical Rule</th>
                  <th>Billed</th>
                  <th>Correction</th>
                  <th>Eligible</th>
                </tr>
              </thead>
              <tbody>
                {claim.lines.map((line) => {
                  const isAdjusted = line.correction > 0;
                  return (
                    <tr key={line.id}>
                      <td>
                        <span className="line-id">{line.id}</span>
                      </td>
                      <td>
                        <strong>{line.service}</strong>
                        <small className="table-sub">{line.basis}</small>
                      </td>
                      <td className="money-cell">{kes(line.billed)}</td>
                      <td className={isAdjusted ? "money-cell correction-cell" : "money-cell"}>
                        {isAdjusted ? `− ${kes(line.correction)}` : "—"}
                      </td>
                      <td className="money-cell" style={{ fontWeight: "700" }}>
                        {kes(line.eligible)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Total Deduplicated Summary</strong>
                  </td>
                  <td>
                    <strong>{kes(claim.billed)}</strong>
                  </td>
                  <td className="correction-cell">
                    <strong>− {kes(claim.correction)}</strong>
                  </td>
                  <td>
                    <strong style={{ color: "#276c54" }}>{kes(claim.eligible)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="inline-callout" style={{ marginTop: "12px" }}>
            <span>ⓘ</span>
            <p>
              <strong>Correction Deduplication (FR13):</strong> L03 MRI has overlapping tariff and authorization findings;
              the deduction is KES 3,000 once (not KES 6,000). L05 duplicate CBC is absorbed entirely without duplicate tariff deductions.
            </p>
          </div>
        </section>

        {/* CASE PROGRESSION & SUPPORTING EVIDENCE */}
        <div>
          <section className="panel" style={{ marginBottom: "14px" }}>
            <div className="panel-header">
              <div>
                <p className="panel-kicker">SUPPORTING EVIDENCE</p>
                <h2>Documents & Referrals</h2>
              </div>
            </div>
            <div className="upload-placeholder" style={{ cursor: "pointer" }} onClick={() => setShowDocumentModal(true)}>
              <span className="upload-icon">📄</span>
              <div style={{ flex: 1 }}>
                <strong>Hospital_Bill_Case_001.pdf</strong>
                <span>Scanned bill · Riverside Medical Centre · 184 KB</span>
              </div>
              <span className="text-link">Preview ↗</span>
            </div>
            <div
              className="upload-placeholder"
              style={{ marginTop: "8px", cursor: "pointer" }}
              onClick={() => setShowDocumentModal(true)}
            >
              <span className="upload-icon">📋</span>
              <div style={{ flex: 1 }}>
                <strong>MRI_Referral_Neurology.pdf</strong>
                <span>Clinical referral note · Dr. K. Omondi · 92 KB</span>
              </div>
              <span className="text-link">Preview ↗</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">LIFECYCLE TIMELINE</p>
                <h2>Case Progression</h2>
              </div>
            </div>
            <div className="audit-list">
              {claim.timeline.map((event, index) => (
                <article className="audit-item" key={`${event.date}-${event.title}`}>
                  <span className="audit-marker">{index + 1}</span>
                  <div className="audit-event">
                    <div>
                      <strong>{event.title}</strong>
                      <span className="audit-date">{event.date}</span>
                    </div>
                    <p>{event.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {showDocumentModal && (
        <div className="profile-popover" style={{ top: "15%", left: "50%", transform: "translateX(-50%)", width: "min(550px, 95vw)" }}>
          <div className="panel-header">
            <div>
              <p className="panel-kicker">EVIDENCE VIEWER · DECISION D10</p>
              <h2>Hospital_Bill_Case_001.pdf</h2>
            </div>
            <button className="button button-muted" onClick={() => setShowDocumentModal(false)}>
              ✕ Close
            </button>
          </div>
          <div style={{ padding: "16px", background: "#f8faf8", borderRadius: "8px", border: "1px solid #e2eae3" }}>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#4d6055" }}>
              <strong>Facility:</strong> Riverside Medical Centre | <strong>Date:</strong> 22 Sep 2026
            </p>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#4d6055" }}>
              <strong>Patient:</strong> Daniel Mwangi | <strong>Encounter:</strong> ENC-RMC-2026-0922
            </p>
            <div style={{ borderTop: "1px dashed #d0ded3", paddingTop: "10px", fontSize: "12px", color: "#77857e" }}>
              <em>Reference bill: 6 lines totaling KES 36,100. This record is for illustration and is not a saved claim.</em>
            </div>
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="button button-primary" onClick={() => setShowDocumentModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="context-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
