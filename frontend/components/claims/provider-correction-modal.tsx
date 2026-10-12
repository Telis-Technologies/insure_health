"use client";

import { useMemo, useState } from "react";
import { kes } from "@/lib/demo-data";
import { apiRequest, ApiUnavailableError } from "@/lib/api-client";

export interface FlaggedAdjustmentLine {
  id: string;
  service: string;
  billed: number;
  correction: number;
  eligible: number;
  basis: string;
  ruleCode: string;
}

export interface LineCorrectionResponse {
  lineId: string;
  action: "accept" | "dispute";
  disputeReason: string;
  requestedEligible: number;
}

const DEFAULT_FLAGGED_LINES: FlaggedAdjustmentLine[] = [
  {
    id: "L01",
    service: "Consultation",
    billed: 2500,
    correction: 500,
    eligible: 2000,
    basis: "Contracted consultation tariff ceiling is KES 2,000 per schedule POL-HHA-OUT-01.",
    ruleCode: "TARIFF-CONS-CAP",
  },
  {
    id: "L02",
    service: "Complete Blood Count (CBC)",
    billed: 1800,
    correction: 300,
    eligible: 1500,
    basis: "Contracted laboratory tariff ceiling for outpatient CBC is KES 1,500.",
    ruleCode: "TARIFF-LAB-CAP",
  },
  {
    id: "L03",
    service: "MRI brain without contrast",
    billed: 28000,
    correction: 3000,
    eligible: 25000,
    basis: "Preauthorization AUTH-HHA-001 ceiling cap is KES 25,000. Tariff overlap absorbed once (FR13).",
    ruleCode: "PREAUTH-CEILING-CAP",
  },
  {
    id: "L05",
    service: "Complete Blood Count (Duplicate CBC)",
    billed: 1800,
    correction: 1800,
    eligible: 0,
    basis: "Duplicate laboratory line identified on same encounter date without clinical repeat order.",
    ruleCode: "DUPLICATE-SERVICE-EXCLUSION",
  },
  {
    id: "L06",
    service: "Administration fee",
    billed: 800,
    correction: 800,
    eligible: 0,
    basis: "Administrative overhead charges are non-eligible under standard provider agreement CON-HHA-01.",
    ruleCode: "UNCONTRACTED-FEE-EXCLUSION",
  },
];

interface ProviderCorrectionModalProps {
  claimId: string;
  member: string;
  provider: string;
  encounter: string;
  serviceDate: string;
  originalBilled: number;
  onClose: () => void;
  onSuccess: (correctedSummary: {
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
  }) => void;
}

export function ProviderCorrectionModal({
  claimId,
  member,
  provider,
  encounter,
  serviceDate,
  originalBilled,
  onClose,
  onSuccess,
}: ProviderCorrectionModalProps) {
  // State for line responses
  const [lineResponses, setLineResponses] = useState<Record<string, LineCorrectionResponse>>(() => {
    const initial: Record<string, LineCorrectionResponse> = {};
    DEFAULT_FLAGGED_LINES.forEach((line) => {
      initial[line.id] = {
        lineId: line.id,
        action: "accept",
        disputeReason: "",
        requestedEligible: line.eligible,
      };
    });
    return initial;
  });

  const [providerGeneralNotes, setProviderGeneralNotes] = useState(
    "Accepting contracted tariff adjustments and removing duplicate CBC. Itemized billing corrected in line with CON-HHA-01 terms."
  );
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Quick Accept All Helper
  const handleAcceptAll = () => {
    const updated: Record<string, LineCorrectionResponse> = {};
    DEFAULT_FLAGGED_LINES.forEach((line) => {
      updated[line.id] = {
        lineId: line.id,
        action: "accept",
        disputeReason: "",
        requestedEligible: line.eligible,
      };
    });
    setLineResponses(updated);
    setProviderGeneralNotes(
      "Accepting all reviewer adjustments (KES 6,400 deductions applied). Corrected eligible charges resubmitted as KES 29,700."
    );
    setValidationError(null);
  };

  // Toggle Action for Line
  const handleToggleAction = (lineId: string, action: "accept" | "dispute") => {
    const line = DEFAULT_FLAGGED_LINES.find((l) => l.id === lineId);
    if (!line) return;

    setLineResponses((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        action,
        requestedEligible: action === "accept" ? line.eligible : line.billed,
      },
    }));
  };

  const handleDisputeReasonChange = (lineId: string, text: string) => {
    setLineResponses((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        disputeReason: text,
      },
    }));
  };

  // Live Recalculation
  const financialSummary = useMemo(() => {
    let totalDeduction = 0;
    let totalEligible = 1200; // Unflagged L04 Medication is KES 1,200

    DEFAULT_FLAGGED_LINES.forEach((line) => {
      const resp = lineResponses[line.id];
      if (resp?.action === "accept") {
        totalDeduction += line.correction;
        totalEligible += line.eligible;
      } else {
        // Disputed line: provider claims original billed amount (or requested amount)
        const requested = resp?.requestedEligible ?? line.billed;
        const remainingDeduction = Math.max(0, line.billed - requested);
        totalDeduction += remainingDeduction;
        totalEligible += requested;
      }
    });

    const insurerShare = Math.round(totalEligible * 0.9);
    const memberShare = Math.round(totalEligible * 0.1);

    return {
      totalDeduction,
      totalEligible,
      insurerShare,
      memberShare,
    };
  }, [lineResponses]);

  // Form Submission (FR05, FR15)
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate that disputed lines have a justification
    const disputedLines = Object.values(lineResponses).filter((r) => r.action === "dispute");
    for (const d of disputedLines) {
      if (!d.disputeReason.trim()) {
        setValidationError(`Please supply clinical justification for disputed line ${d.lineId}.`);
        return;
      }
    }

    setIsSubmitting(true);

    const fullLinesList = [
      ...DEFAULT_FLAGGED_LINES.map((line) => {
        const resp = lineResponses[line.id];
        const isAccepted = resp?.action === "accept";
        return {
          id: line.id,
          service: line.service,
          billed: line.billed,
          correction: isAccepted ? line.correction : line.billed - (resp?.requestedEligible ?? line.billed),
          eligible: isAccepted ? line.eligible : (resp?.requestedEligible ?? line.billed),
          basis: isAccepted
            ? line.basis
            : `Provider Disputed: "${resp?.disputeReason || "No explanation"}"`,
        };
      }),
      {
        id: "L04",
        service: "Medication",
        billed: 1200,
        correction: 0,
        eligible: 1200,
        basis: "Approved within benefit limits",
      },
    ].sort((a, b) => a.id.localeCompare(b.id));

    const payload = {
      claimId,
      version: 2,
      submissionDate: "2026-09-24",
      itemizedResponses: lineResponses,
      eligibleTotal: financialSummary.totalEligible,
      correctionTotal: financialSummary.totalDeduction,
      insurerShare: financialSummary.insurerShare,
      memberShare: financialSummary.memberShare,
      providerNotes: providerGeneralNotes.trim(),
      evidence: evidenceFile ? { name: evidenceFile.name, size: evidenceFile.size, mode: "SYNTHETIC_LOCAL_INPUT" } : null,
    };

    try {
      await apiRequest(`claims/${encodeURIComponent(claimId)}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(
        new CustomEvent("claimwise:feedback", {
          detail: `Corrected Version 2 submitted for ${claimId}. Reviewer workbench notified.`,
        })
      );

      onSuccess({
        eligible: financialSummary.totalEligible,
        correction: financialSummary.totalDeduction,
        insurerShare: financialSummary.insurerShare,
        memberShare: financialSummary.memberShare,
        lines: fullLinesList,
        providerNotes: providerGeneralNotes,
        evidenceFilename: evidenceFile?.name,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiUnavailableError || (err instanceof Error && err.name === "ApiUnavailableError")) {
        const msg = `[PREVIEW MODE] Version 2 created locally (${kes(financialSummary.totalEligible)}). Original V1 preserved as immutable history.`;
        window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: msg }));

        onSuccess({
          eligible: financialSummary.totalEligible,
          correction: financialSummary.totalDeduction,
          insurerShare: financialSummary.insurerShare,
          memberShare: financialSummary.memberShare,
          lines: fullLinesList,
          providerNotes: providerGeneralNotes,
          evidenceFilename: evidenceFile?.name,
        });
        onClose();
      } else {
        setValidationError(err instanceof Error ? err.message : "Failed to submit provider correction.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="profile-popover"
      style={{
        position: "fixed",
        top: "5%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(880px, 96vw)",
        maxHeight: "90vh",
        overflowY: "auto",
        zIndex: 1000,
        boxShadow: "0 24px 48px -12px rgba(18, 38, 28, 0.28)",
        borderRadius: "12px",
        background: "#ffffff",
        border: "1px solid #d4ded7",
        padding: "24px",
      }}
    >
      {/* MODAL HEADER */}
      <div className="panel-header" style={{ marginBottom: "16px", borderBottom: "1px solid #eef2ef", paddingBottom: "12px" }}>
        <div>
          <p className="panel-kicker" style={{ color: "#276c54", fontWeight: "600" }}>
            TASK T14 · PROVIDER CORRECTION WORKBENCH (FR15)
          </p>
          <h2 style={{ fontSize: "20px", margin: "2px 0 4px" }}>
            Respond to Reviewer Adjustments · Case 001
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#617369" }}>
            {provider} · Patient: <strong>{member}</strong> · Encounter: <strong>{encounter}</strong> ({serviceDate})
          </p>
        </div>
        <button
          className="button button-muted"
          type="button"
          onClick={onClose}
          style={{ minHeight: "32px", padding: "0 10px" }}
        >
          ✕ Close
        </button>
      </div>

      {/* POLICY & IMMUTABILITY BANNER (FR05) */}
      <div className="notice-banner" style={{ marginBottom: "16px" }}>
        <span className="notice-icon">i</span>
        <div style={{ flex: 1 }}>
          <strong>Version Integrity Boundary (FR05 & FR15)</strong>
          <span>
            The original submitted bill (<strong>Version 1 · {kes(originalBilled)}</strong>) remains permanent and inspectable.
            Submitting this response generates a linked <strong>Version 2 (Provider Corrected)</strong> which enters re-review.
          </span>
        </div>
        <span className="notice-tag">IMMUTABLE ORIGINAL</span>
      </div>

      {validationError && (
        <div className="form-error" style={{ marginBottom: "16px" }}>
          <strong>Correction Error:</strong> {validationError}
        </div>
      )}

      {/* QUICK ACTIONS BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f3f8f5",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid #d7e6dc",
          marginBottom: "16px",
        }}
      >
        <div>
          <strong style={{ fontSize: "13px", color: "#224736" }}>Reference Benchmark Case 001</strong>
          <p style={{ margin: 0, fontSize: "12px", color: "#556e60" }}>
            Reviewer flagged 5 adjustments totaling −KES 6,400 against contracted tariffs and preauthorization limits.
          </p>
        </div>
        <button
          className="button button-outline"
          type="button"
          onClick={handleAcceptAll}
          style={{ background: "#ffffff", borderColor: "#276c54", color: "#276c54", fontWeight: "600" }}
        >
          ⚡ Accept All Adjustments (KES 29,700)
        </button>
      </div>

      <form onSubmit={handleSubmitCorrection}>
        {/* FLAGGED ADJUSTMENTS LIST */}
        <section className="panel" style={{ marginBottom: "16px" }}>
          <div className="panel-header">
            <div>
              <p className="panel-kicker">STEP 1 · ITEMIZED REVIEW</p>
              <h3 style={{ fontSize: "16px", margin: 0 }}>Reviewer Findings & Provider Action</h3>
            </div>
            <span className="notice-tag">5 ADJUSTMENTS FLAGGED</span>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {DEFAULT_FLAGGED_LINES.map((line) => {
              const resp = lineResponses[line.id];
              const isAccepted = resp?.action === "accept";

              return (
                <div
                  key={line.id}
                  style={{
                    border: `1px solid ${isAccepted ? "#d9e5dc" : "#e0cfaf"}`,
                    background: isAccepted ? "#fafcfa" : "#fffdf8",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="line-id">{line.id}</span>
                        <strong style={{ fontSize: "14px" }}>{line.service}</strong>
                        <span className="status-pill status-reference" style={{ fontSize: "10px", padding: "1px 6px" }}>
                          {line.ruleCode}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#607268" }}>
                        {line.basis}
                      </p>
                    </div>

                    {/* Financial Figures */}
                    <div style={{ textAlign: "right", minWidth: "160px" }}>
                      <div style={{ fontSize: "12px", color: "#77857e" }}>
                        Billed: <strong>{kes(line.billed)}</strong>
                      </div>
                      <div style={{ fontSize: "12px", color: "#b94a48", fontWeight: "600" }}>
                        Adjustment: − {kes(line.correction)}
                      </div>
                      <div style={{ fontSize: "13px", color: "#276c54", fontWeight: "700" }}>
                        Proposed: {kes(line.eligible)}
                      </div>
                    </div>
                  </div>

                  {/* Provider Action Selector */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "10px",
                      paddingTop: "8px",
                      borderTop: "1px dashed #e1eae3",
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className={`tab ${isAccepted ? "active" : ""}`}
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => handleToggleAction(line.id, "accept")}
                      >
                        ✓ Accept Adjustment ({kes(line.eligible)})
                      </button>
                      <button
                        type="button"
                        className={`tab ${!isAccepted ? "active" : ""}`}
                        style={{ padding: "4px 10px", fontSize: "12px", borderColor: !isAccepted ? "#b8860b" : "" }}
                        onClick={() => handleToggleAction(line.id, "dispute")}
                      >
                        ⚠ Dispute Finding
                      </button>
                    </div>

                    <span style={{ fontSize: "12px", color: isAccepted ? "#276c54" : "#996515", fontWeight: "600" }}>
                      {isAccepted
                        ? `Effective eligible: ${kes(line.eligible)}`
                        : `Disputing reduction (claiming ${kes(resp?.requestedEligible ?? line.billed)})`}
                    </span>
                  </div>

                  {/* Dispute Clinical Justification Box */}
                  {!isAccepted && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "10px",
                        background: "#fef9ee",
                        borderRadius: "6px",
                        border: "1px solid #ebd7b2",
                      }}
                    >
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#7c5513", marginBottom: "4px" }}>
                        Clinical Justification & Tariff Appeal Rationale *
                      </label>
                      <textarea
                        rows={2}
                        value={resp?.disputeReason || ""}
                        onChange={(e) => handleDisputeReasonChange(line.id, e.target.value)}
                        placeholder="Document clinical indication, consultant recommendation, or tariff clause justification..."
                        required
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          fontSize: "12px",
                          borderRadius: "4px",
                          border: "1px solid #d3bf99",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* STEP 2: GENERAL NOTES & EVIDENCE */}
        <section className="panel" style={{ marginBottom: "16px" }}>
          <div className="panel-header">
            <div>
              <p className="panel-kicker">STEP 2 · RESPONSE REMARKS & EVIDENCE</p>
              <h3 style={{ fontSize: "16px", margin: 0 }}>Supporting Documentation & Rationale</h3>
            </div>
            <span className="status-pill status-reference">Decision D10 · Preview</span>
          </div>

          <label className="form-field">
            <span>Provider Reconciliation Remarks</span>
            <textarea
              rows={2}
              value={providerGeneralNotes}
              onChange={(e) => setProviderGeneralNotes(e.target.value)}
              placeholder="Summary notes regarding the resubmitted bill..."
            />
          </label>

          <div className="form-field" style={{ marginTop: "10px" }}>
            <span>Attach Revised Bill or Clinical Addendum (.pdf, .png)</span>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {evidenceFile && (
            <div className="upload-placeholder" style={{ marginTop: "8px" }}>
              <span className="upload-icon">📄</span>
              <div>
                <strong>{evidenceFile.name}</strong>
                <span>{(evidenceFile.size / 1024).toFixed(1)} KB · Staged in local provider session</span>
              </div>
            </div>
          )}
        </section>

        {/* FINANCIAL SUMMARY RECALCULATION HERO */}
        <div
          style={{
            background: "#f6faf7",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #d4e4d8",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <strong style={{ fontSize: "14px", color: "#1b402e" }}>Corrected Version 2 Projection</strong>
            <span className="notice-tag">REVALIDATED FINANCIAL SPLIT</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
            <div className="context-item">
              <span>Original Billed</span>
              <strong>{kes(originalBilled)}</strong>
            </div>
            <div className="context-item">
              <span>Total Deductions</span>
              <strong style={{ color: "#a83232" }}>− {kes(financialSummary.totalDeduction)}</strong>
            </div>
            <div className="context-item">
              <span>Revised Eligible</span>
              <strong style={{ color: "#276c54", fontSize: "16px" }}>{kes(financialSummary.totalEligible)}</strong>
            </div>
            <div className="context-item">
              <span>Insurer Payable (90%)</span>
              <strong>{kes(financialSummary.insurerShare)}</strong>
            </div>
            <div className="context-item">
              <span>Member Share (10%)</span>
              <strong>{kes(financialSummary.memberShare)}</strong>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="form-actions" style={{ justifyContent: "flex-end", gap: "10px" }}>
          <button className="button button-outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting Correction..." : `Submit Corrected Version 2 (${kes(financialSummary.totalEligible)})`}
          </button>
        </div>
      </form>
    </div>
  );
}
