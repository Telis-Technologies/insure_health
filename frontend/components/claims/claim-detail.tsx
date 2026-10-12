"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { demoProviders, kes, referenceCases } from "@/lib/demo-data";
import { ProviderCorrectionModal } from "@/components/claims/provider-correction-modal";

export function ClaimDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const [selectedVersion, setSelectedVersion] = useState<"v1" | "v2">("v1");
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [customV2, setCustomV2] = useState<{
    eligible: number;
    correction: number;
    insurerShare: number;
    memberShare: number;
    lines: Array<{
      id: string;
      service: string;
      billed: number;
      correction: number;
      eligible: number;
      basis: string;
    }>;
    providerNotes: string;
    evidenceFilename?: string;
  } | null>(null);

  const claim = referenceCases.find((item) => item.fixtureId.toLowerCase() === id.toLowerCase());

  if (!claim) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CLAIMS / NOT FOUND</div>
            <h1>Claim Not Found</h1>
            <p className="page-subtitle">The requested claim reference "{id}" does not exist in the register.</p>
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

  // Effective figures for Version 2 (custom submitted or fixture benchmark)
  const v2Eligible = customV2?.eligible ?? claim.eligible;
  const v2Correction = customV2?.correction ?? claim.correction;
  const v2InsurerShare = customV2?.insurerShare ?? claim.insurerShare;
  const v2MemberShare = customV2?.memberShare ?? claim.memberShare;
  const v2Lines = customV2?.lines ?? claim.lines;

  const currentEligible = selectedVersion === "v1" ? claim.billed : v2Eligible;
  const currentLines = selectedVersion === "v1"
    ? claim.lines.map((l) => ({ ...l, correction: 0, eligible: l.billed, basis: "Original submitted line" }))
    : v2Lines;

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
            <i /> {selectedVersion === "v2" ? "Under Review · V2" : claim.status}
          </span>
          <span className="notice-tag">
            {selectedVersion === "v1" ? "VERSION 1 (IMMUTABLE)" : "VERSION 2 (CORRECTED)"}
          </span>
          {isAuthorizedProvider && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setShowCorrectionModal(true)}
              style={{ fontSize: "13px" }}
            >
              <span>⚡</span> {selectedVersion === "v1" ? "Respond to Findings (T14)" : "Revise Correction"}
            </button>
          )}
        </div>
      </div>

      {/* PROVIDER CORRECTION ACTION BANNER (FR15) */}
      <div
        className="notice-banner"
        style={{
          marginBottom: "16px",
          background: selectedVersion === "v1" ? "#fdfbf4" : "#f4f9f6",
          borderColor: selectedVersion === "v1" ? "#e9d8b4" : "#cde0d3",
        }}
      >
        <span
          className="notice-icon"
          style={{
            background: selectedVersion === "v1" ? "#c78512" : "#276c54",
            color: "#ffffff",
          }}
        >
          {selectedVersion === "v1" ? "⚠" : "✓"}
        </span>
        <div style={{ flex: 1 }}>
          <strong>
            {selectedVersion === "v1"
              ? "Reviewer Deductions Pending Provider Action (Task T14 · FR15)"
              : "Version 2 Active · Provider Resubmission Linked (FR05)"}
          </strong>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: selectedVersion === "v1" ? "#6d5420" : "#355944" }}>
            {selectedVersion === "v1"
              ? "Reviewer flagged 5 adjustments totaling −KES 6,400. You can accept contractual tariff caps to create Version 2 (KES 29,700) or file a line-by-line dispute with clinical rationale."
              : `Provider accepted adjustments totaling −${kes(v2Correction)}. Revised eligible charges stand at ${kes(v2Eligible)}. Original Version 1 remains immutably preserved.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {selectedVersion === "v1" ? (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setShowCorrectionModal(true)}
              style={{ fontSize: "12px", minHeight: "32px", padding: "0 10px", background: "#ffffff" }}
            >
              Open Correction Workbench ↗
            </button>
          ) : (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setSelectedVersion("v1")}
              style={{ fontSize: "12px", minHeight: "32px", padding: "0 10px", background: "#ffffff" }}
            >
              Inspect Original V1 (KES 36,100)
            </button>
          )}
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
            Version 2 (Provider Corrected · {kes(v2Eligible)})
          </button>
        </div>
        <span className="muted-label">
          {selectedVersion === "v1"
            ? "Submitted 23 Sep 2026 · Original bill preserved"
            : customV2
            ? "Resubmitted just now · Linked Version 2"
            : "Resubmitted 24 Sep 2026 · Deduplicated KES 6,400 correction"}
        </span>
      </div>

      {/* HERO FINANCIAL METRICS */}
      <section className="detail-hero-grid" style={{ marginBottom: "14px" }}>
        <div className="panel detail-amount-card">
          <div className="panel-kicker">
            {selectedVersion === "v1" ? "SUBMITTED BILLED TOTAL (V1)" : "ELIGIBLE AFTER CORRECTIONS (V2)"}
          </div>
          <strong>{kes(currentEligible)}</strong>
          <span>
            {claim.lines.length} bill lines · {selectedVersion === "v1" ? "Original submission" : "Corrected revalidation"}
          </span>

          <div className="detail-amount-divider" />

          <div className="hero-pairs">
            <span>Billed charges</span>
            <strong>{kes(claim.billed)}</strong>

            <span>Proposed corrections</span>
            <strong className="correction-cell">− {kes(selectedVersion === "v1" ? claim.correction : v2Correction)}</strong>

            <span>Eligible charges</span>
            <strong style={{ color: "#276c54" }}>{kes(currentEligible)}</strong>

            <span>Insurer payable (90%)</span>
            <strong>{kes(selectedVersion === "v1" ? Math.round(claim.billed * 0.9) : v2InsurerShare)}</strong>

            <span>Member share (10%)</span>
            <strong>{kes(selectedVersion === "v1" ? Math.round(claim.billed * 0.1) : v2MemberShare)}</strong>

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
                {selectedVersion === "v1" ? "ORIGINAL BILL LINES (V1 IMMUTABLE)" : "CORRECTED BILL LINES (V2)"}
              </p>
              <h2>Itemized Claim Services & Adjustments</h2>
            </div>
            <span className="notice-tag">{currentLines.length} LINES</span>
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
                {currentLines.map((line) => {
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
                    <strong>− {kes(selectedVersion === "v1" ? 0 : v2Correction)}</strong>
                  </td>
                  <td>
                    <strong style={{ color: "#276c54" }}>{kes(currentEligible)}</strong>
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

            {customV2?.evidenceFilename && (
              <div
                className="upload-placeholder"
                style={{ marginTop: "8px", borderLeft: "3px solid #276c54" }}
              >
                <span className="upload-icon">📎</span>
                <div style={{ flex: 1 }}>
                  <strong>{customV2.evidenceFilename}</strong>
                  <span>Provider correction evidence · Attached for V2 re-review</span>
                </div>
                <span className="status-pill status-reference" style={{ fontSize: "11px" }}>V2 ADDENDUM</span>
              </div>
            )}
          </section>

          {/* PROVIDER RECONCILIATION NOTES IF AVAILABLE */}
          {(customV2 || selectedVersion === "v2") && (
            <section className="panel" style={{ marginBottom: "14px" }}>
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">PROVIDER REMARKS · FR15</p>
                  <h2>Reconciliation Justification</h2>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#4f6356", lineHeight: "1.5" }}>
                {customV2?.providerNotes ||
                  "Accepting contractual tariff ceilings for consultation and CBC. Duplicate CBC removed. Revised itemized bill totaling KES 29,700 resubmitted under CON-HHA-01."}
              </p>
            </section>
          )}

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">LIFECYCLE TIMELINE</p>
                <h2>Case Progression</h2>
              </div>
            </div>
            <div className="audit-list">
              {[
                ...claim.timeline,
                ...(customV2
                  ? [
                      {
                        date: "Today · Just now",
                        title: "Provider resubmission (Version 2)",
                        detail: `Corrected claim resubmitted at ${kes(v2Eligible)}. Original Version 1 preserved.`,
                      },
                    ]
                  : []),
              ].map((event, index) => (
                <article className="audit-item" key={`${event.date}-${event.title}-${index}`}>
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
              <em>Itemized bill matches submitted 6 lines totaling KES 36,100. Stored in synthetic demonstration state.</em>
            </div>
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="button button-primary" onClick={() => setShowDocumentModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* PROVIDER CORRECTION MODAL (T14) */}
      {showCorrectionModal && (
        <ProviderCorrectionModal
          claimId={claim.fixtureId}
          member={claim.member}
          provider={claim.provider}
          encounter="ENC-RMC-2026-0922"
          serviceDate={claim.serviceDate}
          originalBilled={claim.billed}
          onClose={() => setShowCorrectionModal(false)}
          onSuccess={(data) => {
            setCustomV2(data);
            setSelectedVersion("v2");
          }}
        />
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
