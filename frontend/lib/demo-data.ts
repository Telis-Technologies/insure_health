/** Deterministic, clearly synthetic directory data for one demo insurer tenant. */
export const demoTenant = "Harbor Health Assurance · Synthetic tenant";

export const demoPolicies = [
  { id: "POL-DEMO-OUT-01", name: "Demo Outpatient Plan", type: "Outpatient", limit: 100000 },
  { id: "POL-DEMO-COM-02", name: "Demo Comprehensive Plan", type: "Comprehensive", limit: 500000 },
  { id: "POL-DEMO-MAT-03", name: "Demo Maternity Plan", type: "Maternity", limit: 250000 },
];

export const demoMembers = Array.from({ length: 50 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");
  const policy = demoPolicies[index % demoPolicies.length];
  return {
    id: `DEMO-MBR-${number}`,
    name: `Synthetic Member ${number}`,
    policyId: policy.id,
    policyName: policy.name,
    insurer: demoTenant,
    status: index % 11 === 0 ? "Pending verification" : "Active",
    dataLabel: "Synthetic · no real patient data",
  };
});

export const demoProviders = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `DEMO-PRO-${number}`,
    name: `Synthetic Health Facility ${number}`,
    county: ["Nairobi", "Kiambu", "Mombasa", "Nakuru", "Kisumu"][index % 5],
    contractId: `DEMO-CON-${number}`,
    status: index % 9 === 0 ? "Pending credentialing" : "Contracted",
    insurer: demoTenant,
    dataLabel: "Synthetic facility",
  };
});

export const demoAuthorizations = Array.from({ length: 12 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");
  return { id: `DEMO-AUTH-${number}`, memberId: demoMembers[index].id, providerId: demoProviders[index % demoProviders.length].id, service: "Synthetic imaging authorization", status: index % 4 === 0 ? "Pending" : "Approved" };
});

export const case001 = {
  fixtureId: "REFERENCE-CASE-001",
  member: "Daniel Mwangi",
  insurer: "Harbor Health Assurance",
  provider: "Riverside Medical Centre",
  tpa: "MediBridge Administrators",
  policy: "POL-2026-001",
  contract: "CON-2026-017",
  authorization: "AUTH-001",
  serviceDate: "22 Sep 2026",
  billed: 36100,
  correction: 6400,
  eligible: 29700,
  memberShare: 2970,
  insurerShare: 26730,
  remainingBenefit: 55270,
  variance: 0,
  lines: [
    { id: "L01", service: "Consultation", billed: 2500, correction: 500, eligible: 2000, basis: "Tariff adjustment" },
    { id: "L02", service: "CBC", billed: 1800, correction: 300, eligible: 1500, basis: "Tariff adjustment" },
    { id: "L03", service: "MRI brain without contrast", billed: 28000, correction: 3000, eligible: 25000, basis: "Authorization ceiling / tariff overlap" },
    { id: "L04", service: "Medication", billed: 1200, correction: 0, eligible: 1200, basis: "No correction in fixture" },
    { id: "L05", service: "Duplicate CBC", billed: 1800, correction: 1800, eligible: 0, basis: "Duplicate line" },
    { id: "L06", service: "Administration fee", billed: 800, correction: 800, eligible: 0, basis: "Excluded fee" },
  ],
  timeline: [
    { date: "22 Sep 2026", title: "Care received", detail: "Riverside Medical Centre · outpatient encounter" },
    { date: "23 Sep 2026", title: "Claim submitted and assessed", detail: "Original bill total KES 36,100" },
    { date: "24 Sep 2026", title: "Provider correction", detail: "Corrected eligible amount KES 29,700" },
    { date: "25 Sep 2026", title: "Adjudication", detail: "Fixture reference date; reviewer event details are not supplied" },
    { date: "02 Oct 2026", title: "Simulated payment", detail: "Expected insurer share KES 26,730" },
  ],
};

export function kes(value: number) {
  return `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value)}`;
}

export const ruleBasis = [
  { title: "Agreed tariff", detail: "Consultation, CBC and MRI adjustments", version: "Version not supplied by fixture", tone: "blue" },
  { title: "Authorization ceiling", detail: "MRI brain without contrast · ceiling KES 25,000", version: "AUTH-001 · service date 22 Sep 2026", tone: "violet" },
  { title: "Duplicate service", detail: "Duplicate CBC line removed once", version: "Rule version not supplied by fixture", tone: "amber" },
  { title: "Excluded service", detail: "Administration fee is not eligible in this case", version: "Rule version not supplied by fixture", tone: "rose" },
];
