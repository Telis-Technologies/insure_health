"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { demoMembers, demoProviders } from "@/lib/demo-data";
import { apiRequest, ApiUnavailableError } from "@/lib/api-client";

export function AuthorizationNew() {
  const router = useRouter();
  const { data: session } = useSession();

  const [member, setMember] = useState("");
  const [provider, setProvider] = useState("");
  const [serviceCategory, setServiceCategory] = useState("Diagnostic imaging");
  const [serviceName, setServiceName] = useState("");
  const [clinicalJustification, setClinicalJustification] = useState("");
  const [requestedCeiling, setRequestedCeiling] = useState("25000");
  const [serviceDate, setServiceDate] = useState("2026-09-22");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const memberChoices = useMemo(() => demoMembers.map((item) => `${item.id} · ${item.name}`), []);
  const memberId = member.split(" · ")[0];
  const selectedMember = useMemo(() => demoMembers.find((item) => item.id === memberId), [memberId]);

  const providerChoices = useMemo(() => {
    const orgIds = session?.user?.organizationIds ?? [];
    const filtered = orgIds.length > 0
      ? demoProviders.filter((item) => orgIds.includes(item.id))
      : demoProviders;
    return filtered.map((item) => `${item.id} · ${item.name}`);
  }, [session?.user?.organizationIds]);

  const providerId = provider.split(" · ")[0];
  const selectedProvider = useMemo(() => demoProviders.find((item) => item.id === providerId), [providerId]);

  const handlePreFillCase001 = () => {
    const caseMember = demoMembers[0];
    const caseProvider = demoProviders[0];
    setMember(`${caseMember.id} · ${caseMember.name}`);
    setProvider(`${caseProvider.id} · ${caseProvider.name}`);
    setServiceCategory("Diagnostic imaging");
    setServiceName("MRI brain without contrast");
    setClinicalJustification("Persistent severe headaches and progressive neurological deficits. Ruling out intracranial pathology.");
    setRequestedCeiling("25000");
    setServiceDate("2026-09-22");
    setFeedback("Reference Case 001 authorization pre-filled (AUTH-HHA-001 · KES 25,000 ceiling).");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!member || !provider || !serviceName.trim() || !requestedCeiling) {
      setFeedback("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      memberId,
      providerId,
      serviceCategory,
      serviceName: serviceName.trim(),
      clinicalJustification: clinicalJustification.trim(),
      requestedCeiling: Number(requestedCeiling),
      serviceDate,
    };

    try {
      await apiRequest("authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(
        new CustomEvent("claimwise:feedback", {
          detail: "Preauthorization request submitted to insurer medical review team.",
        })
      );
      router.push("/authorizations");
    } catch (err) {
      if (err instanceof ApiUnavailableError || (err instanceof Error && err.name === "ApiUnavailableError")) {
        setFeedback("Request not saved: the authorization service is unavailable. Your entered details remain on this page; try again when the service is connected.");
      } else {
        setFeedback(err instanceof Error ? err.message : "Failed to submit authorization.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            HEALTH RECORDS / AUTHORIZATIONS <span className="eyebrow-dot">·</span> TASK T09
          </div>
          <h1>Request Preauthorization</h1>
          <p className="page-subtitle">
            Submit prior approval for specialized diagnostic imaging, surgery or inpatient admissions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="button button-outline" type="button" onClick={handlePreFillCase001}>
            <span>⚡</span> Pre-fill Case 001 (MRI Scan)
          </button>
          <Link className="button button-outline" href="/authorizations">
            ← Back to authorizations
          </Link>
        </div>
      </div>

      <div className="notice-banner">
        <span className="notice-icon">i</span>
        <div>
          <strong>Preauthorization Scope (FR06 & FR07)</strong>
          <span>
            An approved authorization binds the specific procedure, validity date, and financial ceiling. It does not
            grant unconditional blanket approval for uncontracted hospital fees.
          </span>
        </div>
        <span className="notice-tag">DECISION D02</span>
      </div>

      {feedback && (
        <div className="form-info" style={{ marginBottom: "16px" }}>
          {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-layout">
        <div className="form-main">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 1 · PATIENT & FACILITY</p>
                <h2>Care Identification</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Insured Member *</span>
                <input
                  list="auth-members-list"
                  value={member}
                  onChange={(e) => setMember(e.target.value)}
                  placeholder="Select member"
                  required
                />
                <datalist id="auth-members-list">
                  {memberChoices.map((choice) => (
                    <option key={choice} value={choice} />
                  ))}
                </datalist>
                {selectedMember && (
                  <small className="form-helper" style={{ color: "#326e54" }}>
                    ✓ {selectedMember.name} ({selectedMember.policyName})
                  </small>
                )}
              </label>

              <label className="form-field">
                <span>Requesting Healthcare Facility *</span>
                <input
                  list="auth-providers-list"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Select provider facility"
                  required
                />
                <datalist id="auth-providers-list">
                  {providerChoices.map((choice) => (
                    <option key={choice} value={choice} />
                  ))}
                </datalist>
                {selectedProvider && (
                  <small className="form-helper">
                    County: {selectedProvider.county} · Contract: {selectedProvider.contractId}
                  </small>
                )}
              </label>

              <label className="form-field">
                <span>Planned Service Date *</span>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Service Category *</span>
                <select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
                  <option value="Diagnostic imaging">Diagnostic imaging</option>
                  <option value="Specialist procedure">Specialist procedure</option>
                  <option value="Inpatient admission">Inpatient admission</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 2 · CLINICAL JUSTIFICATION</p>
                <h2>Procedure & Clinical Notes</h2>
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: "14px" }}>
              <label className="form-field">
                <span>Specific Procedure / Service *</span>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. MRI brain without contrast"
                  required
                />
              </label>

              <label className="form-field">
                <span>Requested Ceiling Amount (KES) *</span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={requestedCeiling}
                  onChange={(e) => setRequestedCeiling(e.target.value)}
                  placeholder="e.g. 25000"
                  required
                />
                <small className="form-helper">Maximum authorized benefit ceiling for this service.</small>
              </label>
            </div>

            <label className="form-field">
              <span>Clinical Symptoms & Rationale *</span>
              <textarea
                value={clinicalJustification}
                onChange={(e) => setClinicalJustification(e.target.value)}
                placeholder="Explain the clinical indication, medical history, and necessity for prior authorization."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "7px",
                  border: "1px solid #e2e8e3",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
                required
              />
            </label>

            <div className="form-field" style={{ marginTop: "14px" }}>
              <span>Doctor&apos;s Prescription or Referral Letter (Optional attachment)</span>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
              />
              {evidenceFile && (
                <small className="form-helper">
                  Attached: {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)
                </small>
              )}
            </div>
          </section>

          <div className="form-actions">
            <Link className="button button-muted" href="/authorizations">
              Cancel
            </Link>
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Preauthorization Request"}
            </button>
          </div>
        </div>

        <aside className="side-rail">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">POLICY CEILING RULES</p>
                <h2>Adjudication Criteria</h2>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "#697970", lineHeight: "1.5" }}>
              Authorizations are validated against contracted facility tariffs on the date of care.
            </p>
            <ul className="check-list" style={{ marginTop: "12px" }}>
              <li>Applies only to specified service code</li>
              <li>Ceiling caps insurer liability</li>
              <li>Enforces 30-day cross-facility window</li>
            </ul>
          </section>
        </aside>
      </form>
    </>
  );
}
