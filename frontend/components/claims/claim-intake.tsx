"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { demoAuthorizations, demoMembers, demoPolicies, demoProviders, kes } from "@/lib/demo-data";
import { apiRequest, ApiUnavailableError } from "@/lib/api-client";

export interface BillLineItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

const DEFAULT_LINE: BillLineItem = {
  id: "L01",
  code: "",
  description: "",
  quantity: 1,
  unitRate: 0,
  amount: 0,
};

const CASE_001_PREFILL_LINES: BillLineItem[] = [
  { id: "L01", code: "CONS-01", description: "Consultation", quantity: 1, unitRate: 2500, amount: 2500 },
  { id: "L02", code: "LAB-CBC", description: "Complete Blood Count (CBC)", quantity: 1, unitRate: 1800, amount: 1800 },
  { id: "L03", code: "RAD-MRI", description: "MRI brain without contrast", quantity: 1, unitRate: 28000, amount: 28000 },
  { id: "L04", code: "MED-GEN", description: "Medication", quantity: 1, unitRate: 1200, amount: 1200 },
  { id: "L05", code: "LAB-CBC-DUP", description: "Complete Blood Count (Duplicate CBC)", quantity: 1, unitRate: 1800, amount: 1800 },
  { id: "L06", code: "ADM-FEE", description: "Administration fee", quantity: 1, unitRate: 800, amount: 800 },
];

export function ClaimIntake() {
  const router = useRouter();
  const { data: session } = useSession();

  // Form State
  const [member, setMember] = useState("");
  const [policy, setPolicy] = useState("");
  const [provider, setProvider] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [serviceDate, setServiceDate] = useState("2026-09-22");
  const [encounter, setEncounter] = useState("");
  const [careSetting, setCareSetting] = useState("Outpatient");
  const [billLines, setBillLines] = useState<BillLineItem[]>([{ ...DEFAULT_LINE }]);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  // Derived directory lookups
  const memberChoices = useMemo(() => demoMembers.map((item) => `${item.id} · ${item.name}`), []);
  const memberId = member.split(" · ")[0];
  const selectedMember = useMemo(() => demoMembers.find((item) => item.id === memberId), [memberId]);

  // Provider choices scoped to authenticated user or full demo directory
  const providerChoices = useMemo(() => {
    const orgIds = session?.user?.organizationIds ?? [];
    const filtered = orgIds.length > 0
      ? demoProviders.filter((item) => orgIds.includes(item.id))
      : demoProviders;
    return filtered.map((item) => `${item.id} · ${item.name}`);
  }, [session?.user?.organizationIds]);

  const providerId = provider.split(" · ")[0];
  const selectedProvider = useMemo(() => demoProviders.find((item) => item.id === providerId), [providerId]);

  const policyChoices = useMemo(() => demoPolicies.map((item) => `${item.id} · ${item.name}`), []);
  const availablePolicies = useMemo(() => {
    if (!selectedMember) return policyChoices;
    return policyChoices.filter((item) => item.startsWith(`${selectedMember.policyId} ·`));
  }, [selectedMember, policyChoices]);

  // Authorizations matching member and provider
  const availableAuthorizations = useMemo(() => {
    return demoAuthorizations.filter((item) => {
      const matchMember = !memberId || item.memberId === memberId;
      const matchProvider = !providerId || item.providerId === providerId;
      return matchMember && matchProvider;
    });
  }, [memberId, providerId]);

  const selectedAuth = useMemo(() => {
    const authId = authorization.split(" · ")[0];
    return demoAuthorizations.find((item) => item.id === authId);
  }, [authorization]);

  // Financial totals
  const totalBilled = useMemo(() => {
    return billLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [billLines]);

  // Pre-fill Reference Case 001
  const handleLoadCase001 = () => {
    const caseMember = demoMembers[0]; // Daniel Mwangi (MBR-HHA-001)
    const caseProvider = demoProviders[0]; // Riverside Medical Centre (PRO-HHA-01)
    const casePolicy = demoPolicies[0]; // Afya Outpatient (POL-HHA-OUT-01)
    const caseAuth = demoAuthorizations[0]; // AUTH-HHA-001

    setMember(`${caseMember.id} · ${caseMember.name}`);
    setPolicy(`${casePolicy.id} · ${casePolicy.name}`);
    setProvider(`${caseProvider.id} · ${caseProvider.name}`);
    setAuthorization(`${caseAuth.id} · Diagnostic imaging`);
    setServiceDate("2026-09-22");
    setEncounter("ENC-RMC-2026-0922");
    setCareSetting("Outpatient");
    setBillLines(CASE_001_PREFILL_LINES);
    setValidationErrors([]);
    setSubmissionFeedback("Reference Case 001 loaded (6 lines · KES 36,100). Ready for validation and submission.");
  };

  // Line item helpers
  const handleAddLine = () => {
    const nextIndex = billLines.length + 1;
    const lineId = `L${String(nextIndex).padStart(2, "0")}`;
    setBillLines([...billLines, { ...DEFAULT_LINE, id: lineId }]);
  };

  const handleRemoveLine = (index: number) => {
    if (billLines.length <= 1) return;
    const updated = billLines.filter((_, i) => i !== index).map((line, i) => ({
      ...line,
      id: `L${String(i + 1).padStart(2, "0")}`,
    }));
    setBillLines(updated);
  };

  const handleLineChange = (index: number, field: keyof BillLineItem, value: string | number) => {
    setBillLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const updated = { ...line, [field]: value };
        if (field === "quantity" || field === "unitRate") {
          const qty = field === "quantity" ? Number(value) : line.quantity;
          const rate = field === "unitRate" ? Number(value) : line.unitRate;
          updated.amount = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0);
        } else if (field === "amount") {
          updated.amount = Number(value) || 0;
        }
        return updated;
      })
    );
  };

  // Validation
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!member || !selectedMember) {
      errors.push("Select a valid insured member from the directory.");
    } else if (selectedMember.status !== "Active") {
      errors.push("Member coverage status is currently not Active.");
    }

    if (!policy || !availablePolicies.some((p) => p.startsWith(policy.split(" · ")[0]))) {
      errors.push("Select a valid active policy associated with this member.");
    }

    if (!provider || !selectedProvider) {
      errors.push("Select a contracted healthcare facility.");
    } else if (selectedProvider.status !== "Contracted") {
      errors.push("The selected facility is pending credentialing and cannot submit claims.");
    }

    if (!serviceDate) {
      errors.push("Service date is required.");
    }

    if (!encounter.trim()) {
      errors.push("Facility encounter reference is required.");
    }

    // Preauthorization rules: Mandatory for inpatient/maternity, or for high-cost outpatient imaging
    if (careSetting !== "Outpatient" && !authorization) {
      errors.push(`An approved preauthorization is mandatory for ${careSetting} care.`);
    }

    if (authorization && selectedAuth && selectedAuth.status !== "Approved") {
      errors.push(`Authorization ${selectedAuth.id} is in "${selectedAuth.status}" status. Only approved authorizations can be linked.`);
    }

    // Bill lines validation
    if (billLines.length === 0) {
      errors.push("At least one bill line item is required.");
    }

    billLines.forEach((line, index) => {
      if (!line.code.trim()) errors.push(`Line ${index + 1}: Service code is required.`);
      if (!line.description.trim()) errors.push(`Line ${index + 1}: Service description is required.`);
      if (!line.quantity || line.quantity <= 0) errors.push(`Line ${index + 1}: Quantity must be at least 1.`);
      if (!line.amount || line.amount <= 0) errors.push(`Line ${index + 1}: Amount must be a positive number.`);
    });

    return errors;
  };

  // Form submission (FR04, FR05)
  const handleSubmit = async (isDraft: boolean) => {
    const errors = validateForm();
    setValidationErrors(errors);

    if (errors.length > 0 && !isDraft) {
      setSubmissionFeedback("Please resolve all validation errors before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const payload = {
      memberId,
      policyId: policy.split(" · ")[0],
      providerId,
      authorizationId: authorization.split(" · ")[0] || null,
      serviceDate,
      encounterRef: encounter.trim(),
      careSetting,
      totalBilled,
      isDraft,
      lines: billLines.map((l) => ({
        id: l.id,
        code: l.code.trim(),
        description: l.description.trim(),
        quantity: l.quantity,
        unitRate: l.unitRate || l.amount / l.quantity,
        amount: l.amount,
      })),
      documentEvidence: billFile ? { filename: billFile.name, size: billFile.size, mode: "SYNTHETIC_LOCAL_INPUT" } : null,
    };

    try {
      // Attempt backend API call to POST /api/v1/claims
      await apiRequest<{ id: string }>("claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(
        new CustomEvent("claimwise:feedback", {
          detail: isDraft ? "Claim draft saved successfully." : "Claim submitted to reviewer workbench (Version 1 immutable).",
        })
      );
      router.push("/claims");
    } catch (err) {
      if (err instanceof ApiUnavailableError || (err instanceof Error && err.name === "ApiUnavailableError")) {
        setSubmissionFeedback("Claim not saved: the claims service is unavailable. Your entered details remain on this page; try again when the service is connected.");
      } else {
        setSubmissionFeedback(err instanceof Error ? err.message : "Failed to submit claim.");
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
            PROVIDER INTAKE <span className="eyebrow-dot">·</span> TASK T09
          </div>
          <h1>Submit New Health Claim</h1>
          <p className="page-subtitle">
            Prepare an itemized provider bill, link preauthorization evidence, and submit an immutable version.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="button button-outline" type="button" onClick={handleLoadCase001}>
            <span>⚡</span> Quick Load Reference Case 001
          </button>
          <Link className="button button-outline" href="/claims">
            ← Back to claims
          </Link>
        </div>
      </div>

      <div className="notice-banner">
        <span className="notice-icon">i</span>
        <div>
          <strong>Version Integrity Boundary (FR05)</strong>
          <span>
            Initial submission creates <strong>Version 1 (Immutable)</strong>. Once submitted, adjustments or corrections
            from the review workbench generate a linked Version 2.
          </span>
        </div>
        <span className="notice-tag">IMMUTABLE V1</span>
      </div>

      {submissionFeedback && (
        <div className="form-info" style={{ marginBottom: "16px" }}>
          <strong>Notice:</strong> {submissionFeedback}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="form-error" style={{ marginBottom: "16px" }}>
          <strong>Please correct the following:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-layout">
        <div className="form-main">
          {/* STEP 1: MEMBER & ENCOUNTER */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 1 · MEMBER & ENCOUNTER</p>
                <h2>Care & Patient Context</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Insured Member reference *</span>
                <input
                  list="demo-members-list"
                  value={member}
                  onChange={(e) => {
                    setMember(e.target.value);
                    setPolicy("");
                    setAuthorization("");
                  }}
                  placeholder="Search member ID or name (e.g. MBR-HHA-001)"
                  required
                />
                <datalist id="demo-members-list">
                  {memberChoices.map((choice) => (
                    <option key={choice} value={choice} />
                  ))}
                </datalist>
                {selectedMember && (
                  <small className="form-helper" style={{ color: "#326e54" }}>
                    ✓ {selectedMember.name} · Status: {selectedMember.status}
                  </small>
                )}
              </label>

              <label className="form-field">
                <span>Applicable Policy *</span>
                <input
                  list="demo-policies-list"
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                  placeholder="Select policy"
                  required
                />
                <datalist id="demo-policies-list">
                  {availablePolicies.map((choice) => (
                    <option key={choice} value={choice} />
                  ))}
                </datalist>
                {selectedMember && (
                  <small className="form-helper">Associated plan for {selectedMember.name}</small>
                )}
              </label>

              <label className="form-field">
                <span>Healthcare Facility (Provider) *</span>
                <input
                  list="demo-providers-list"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setAuthorization("");
                  }}
                  placeholder="Search facility (e.g. Riverside Medical Centre)"
                  required
                />
                <datalist id="demo-providers-list">
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
                <span>Service Date * (Service-Date Versioning)</span>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
                <small className="form-helper">Governs applicable tariffs and policy limits.</small>
              </label>

              <label className="form-field">
                <span>Facility Encounter ID *</span>
                <input
                  value={encounter}
                  onChange={(e) => setEncounter(e.target.value)}
                  placeholder="e.g. ENC-RMC-2026-0922"
                  required
                />
              </label>

              <label className="form-field">
                <span>Care Setting *</span>
                <select value={careSetting} onChange={(e) => setCareSetting(e.target.value)}>
                  <option value="Outpatient">Outpatient</option>
                  <option value="Inpatient">Inpatient</option>
                  <option value="Maternity">Maternity</option>
                </select>
              </label>
            </div>
          </section>

          {/* STEP 2: PREAUTHORIZATION LINKAGE */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 2 · PREAUTHORIZATION EVIDENCE</p>
                <h2>Prior Approval & Ceiling Match</h2>
              </div>
              <Link className="text-link" href="/authorizations">
                Request new authorization <span>↗</span>
              </Link>
            </div>

            <div className="form-field">
              <span>
                Preauthorization Reference{" "}
                {careSetting === "Outpatient" ? "(Required for MRI/CT or Specialized Procedures)" : "*"}
              </span>
              <input
                list="demo-authorizations-list"
                value={authorization}
                onChange={(e) => setAuthorization(e.target.value)}
                placeholder="Search approved preauthorizations (e.g. AUTH-HHA-001)"
              />
              <datalist id="demo-authorizations-list">
                {availableAuthorizations
                  .filter((item) => item.status === "Approved")
                  .map((item) => (
                    <option key={item.id} value={`${item.id} · ${item.service}`} />
                  ))}
              </datalist>
            </div>

            {selectedAuth ? (
              <div className="inline-callout" style={{ marginTop: "12px", borderLeft: "3px solid #276c54" }}>
                <span>◉</span>
                <div style={{ flex: 1 }}>
                  <strong>Linked Authorization: {selectedAuth.id}</strong>
                  <p>
                    Approved Service: <strong>{selectedAuth.service}</strong> | Status:{" "}
                    <span className="status-pill status-reference">{selectedAuth.status}</span>
                    <br />
                    <em>Reference Note: Ceiling is capped at KES 25,000 for service date 22 Sep 2026.</em>
                  </p>
                </div>
              </div>
            ) : (
              <p className="form-helper">
                Leave blank for routine outpatient consultations. Mandatory for inpatient, maternity, or specialized scans.
              </p>
            )}
          </section>

          {/* STEP 3: ITEMIZED BILL LINES */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 3 · BILL LINES</p>
                <h2>Itemized Medical Services & Quantities</h2>
              </div>
              <button className="button button-outline" type="button" onClick={handleAddLine}>
                ＋ Add bill line
              </button>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "45px" }}>Line</th>
                    <th style={{ width: "130px" }}>Service Code *</th>
                    <th>Description *</th>
                    <th style={{ width: "80px" }}>Qty *</th>
                    <th style={{ width: "130px" }}>Unit Rate (KES)</th>
                    <th style={{ width: "140px" }}>Line Total (KES) *</th>
                    <th style={{ width: "50px" }} />
                  </tr>
                </thead>
                <tbody>
                  {billLines.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <span className="line-id">{line.id}</span>
                      </td>
                      <td>
                        <input
                          aria-label={`Service code ${index + 1}`}
                          value={line.code}
                          onChange={(e) => handleLineChange(index, "code", e.target.value)}
                          placeholder="e.g. CONS-01"
                          required
                          style={{ minHeight: "34px", padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Description ${index + 1}`}
                          value={line.description}
                          onChange={(e) => handleLineChange(index, "description", e.target.value)}
                          placeholder="Clinical service description"
                          required
                          style={{ minHeight: "34px", padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          aria-label={`Quantity ${index + 1}`}
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                          required
                          style={{ minHeight: "34px", width: "70px", padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          aria-label={`Rate ${index + 1}`}
                          value={line.unitRate || ""}
                          onChange={(e) => handleLineChange(index, "unitRate", e.target.value)}
                          placeholder="Rate"
                          style={{ minHeight: "34px", width: "110px", padding: "4px 8px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="1"
                          aria-label={`Amount ${index + 1}`}
                          value={line.amount || ""}
                          onChange={(e) => handleLineChange(index, "amount", e.target.value)}
                          required
                          style={{
                            minHeight: "34px",
                            width: "120px",
                            padding: "4px 8px",
                            fontWeight: "600",
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-muted"
                          disabled={billLines.length === 1}
                          onClick={() => handleRemoveLine(index)}
                          title="Remove line"
                          style={{ minHeight: "32px", padding: "0 8px" }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right", paddingRight: "16px" }}>
                      <strong>Total Billed Amount:</strong>
                    </td>
                    <td colSpan={2}>
                      <strong style={{ fontSize: "15px", color: "#276c54" }}>{kes(totalBilled)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* STEP 4: SUPPORTING EVIDENCE */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">STEP 4 · EVIDENCE & ATTACHMENTS</p>
                <h2>Original Bill & Prescription</h2>
              </div>
              <span className="status-pill status-reference">Decision D10 · Local Preview</span>
            </div>

            <div className="form-field">
              <span>Itemized Hospital Bill / Lab & Imaging Order (.pdf, .png, .jpg) *</span>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {billFile ? (
              <div className="upload-placeholder" style={{ marginTop: "10px" }}>
                <span className="upload-icon">📄</span>
                <div>
                  <strong>{billFile.name}</strong>
                  <span>{(billFile.size / 1024).toFixed(1)} KB · Staged in local browser state</span>
                </div>
              </div>
            ) : (
              <p className="form-helper">
                Attach the original scanned hospital bill. The file is sent only when the claims service is connected and accepts the submission.
              </p>
            )}
          </section>

          {/* SUBMISSION BUTTONS */}
          <div className="form-actions" style={{ marginTop: "20px" }}>
            <button
              className="button button-outline"
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
            >
              Save as Draft
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
            >
              {isSubmitting ? "Submitting..." : "Submit Claim for Review (Version 1)"}
            </button>
          </div>
        </div>

        {/* SIDE RAIL SUMMARY */}
        <aside className="side-rail">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">CLAIM SUMMARY</p>
                <h2>Intake Health Check</h2>
              </div>
            </div>

            <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
              <div className="record-row">
                <span>Bill Lines:</span>
                <strong>{billLines.length} lines</strong>
              </div>
              <div className="record-row">
                <span>Total Billed:</span>
                <strong style={{ color: "#276c54" }}>{kes(totalBilled)}</strong>
              </div>
              <div className="record-row">
                <span>Care Setting:</span>
                <strong>{careSetting}</strong>
              </div>
              <div className="record-row">
                <span>Service Date:</span>
                <strong>{serviceDate || "Not set"}</strong>
              </div>
            </div>

            <ul className="check-list">
              <li>Member enrolled in active policy</li>
              <li>Facility matches contracted network</li>
              <li>Preauthorization ceiling verified</li>
              <li>No duplicate billed items</li>
              <li>Supporting evidence linked</li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">REFERENCE CASE 001</p>
                <h2>Benchmark Targets</h2>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "#697970", lineHeight: "1.5" }}>
              Case 001 tests 6 billed lines totaling <strong>KES 36,100</strong>. Assessment checks will flag:
            </p>
            <ul style={{ fontSize: "12px", color: "#7a8a81", paddingLeft: "16px", margin: "8px 0 0" }}>
              <li>L01: KES 500 tariff excess</li>
              <li>L02: KES 300 CBC tariff excess</li>
              <li>L03: KES 3,000 MRI ceiling excess</li>
              <li>L05: KES 1,800 duplicate CBC removal</li>
              <li>L06: KES 800 administrative exclusion</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
