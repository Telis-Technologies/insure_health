/** Local reference records. Names are fictional; no patient data is stored. */
export const demoTenant = "Harbor Health Assurance";

export const demoPolicies = [
  { id: "POL-HHA-OUT-01", name: "Afya Outpatient", type: "Outpatient", limit: 100000 },
  { id: "POL-HHA-COM-02", name: "Afya Comprehensive", type: "Comprehensive", limit: 500000 },
  { id: "POL-HHA-MAT-03", name: "Afya Maternity", type: "Maternity", limit: 250000 },
];

const firstNames = ["Daniel", "Amina", "Wanjiku", "Brian", "Mercy", "Joseph", "Fatuma", "Kevin", "Grace", "Peter", "Lucy", "Ibrahim", "Faith", "Samuel", "Esther", "Collins", "Naomi", "Ahmed", "Beatrice", "Victor", "Sharon", "David", "Halima", "James", "Caroline", "Dennis", "Mary", "Hassan", "Rose", "Elijah", "Janet", "Paul", "Zainab", "Francis", "Lilian", "Michael", "Salma", "John", "Eunice", "George", "Cynthia", "Ali", "Joyce", "Patrick", "Miriam", "Robert", "Njeri", "Felix", "Ruth", "Martin"];
const surnames = ["Mwangi", "Otieno", "Wambui", "Kiptoo", "Njeri", "Omondi", "Mohamed", "Mutua", "Achieng", "Kamau", "Wekesa", "Abdi", "Muthoni", "Ouma", "Chebet", "Barasa", "Nyambura", "Hussein", "Atieno", "Kariuki", "Wairimu", "Odhiambo", "Said", "Kimani", "Wangari", "Maina", "Wanjala", "Ali", "Wambogo", "Kibet", "Wanjiku", "Njenga", "Noor", "Ochieng", "Moraa", "Muriithi", "Abdalla", "Njoroge", "Wambua", "Kiprotich", "Nyokabi", "Hassan", "Oduor", "Mbugua", "Adhiambo", "Wafula", "Gathoni", "Mutiso", "Chepkoech", "Njiru"];
export const demoMembers = firstNames.map((firstName, index) => {
  const number = String(index + 1).padStart(3, "0");
  const policy = demoPolicies[index % demoPolicies.length];
  return {
    id: `MBR-HHA-${number}`,
    name: `${firstName} ${surnames[index]}`,
    policyId: policy.id,
    policyName: policy.name,
    insurer: demoTenant,
    status: index % 11 === 10 ? "Pending verification" : "Active",
  };
});

const facilities: [string, string][] = [["Riverside Medical Centre", "Nairobi"], ["Kilimani Family Clinic", "Nairobi"], ["Westlands Community Hospital", "Nairobi"], ["Parklands Specialist Centre", "Nairobi"], ["Thika Road Medical Centre", "Kiambu"], ["Ruiru Family Hospital", "Kiambu"], ["Nyali Community Clinic", "Mombasa"], ["Mombasa Central Hospital", "Mombasa"], ["Bamburi Medical Centre", "Mombasa"], ["Nakuru Valley Hospital", "Nakuru"], ["Naivasha Lakeside Clinic", "Nakuru"], ["Kisumu Lakeside Hospital", "Kisumu"], ["Milimani Medical Centre", "Kisumu"], ["Eldoret Family Hospital", "Uasin Gishu"], ["Kapsoya Community Clinic", "Uasin Gishu"], ["Meru Highlands Hospital", "Meru"], ["Embu Town Medical Centre", "Embu"], ["Machakos Family Clinic", "Machakos"], ["Kitengela Medical Centre", "Kajiado"], ["Kericho Green Hills Hospital", "Kericho"]];
export const demoProviders = facilities.map(([name, county], index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `PRO-HHA-${number}`,
    name,
    county,
    contractId: `CON-HHA-${number}`,
    status: index % 9 === 8 ? "Pending credentialing" : "Contracted",
    insurer: demoTenant,
  };
});

export const demoAuthorizations = Array.from({ length: 12 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");
  return { id: `AUTH-HHA-${number}`, memberId: demoMembers[index].id, providerId: demoProviders[index % demoProviders.length].id, service: ["Diagnostic imaging", "Specialist procedure", "Inpatient admission"][index % 3], status: index % 4 === 2 ? "Pending" : "Approved" };
});

export const case001 = {
  fixtureId: "REFERENCE-CASE-001",
  member: "Daniel Mwangi",
  insurer: "Harbor Health Assurance",
  provider: "Riverside Medical Centre",
  tpa: "MediBridge Administrators",
  policy: "POL-HHA-OUT-01",
  contract: "CON-HHA-01",
  authorization: "AUTH-HHA-001",
  status: "Paid / reconciled",
  workflow: "Corrected bill and tariff adjustment",
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
    { id: "L04", service: "Medication", billed: 1200, correction: 0, eligible: 1200, basis: "No adjustment" },
    { id: "L05", service: "Duplicate CBC", billed: 1800, correction: 1800, eligible: 0, basis: "Duplicate line" },
    { id: "L06", service: "Administration fee", billed: 800, correction: 800, eligible: 0, basis: "Excluded fee" },
  ],
  timeline: [
    { date: "22 Sep 2026", title: "Care received", detail: "Riverside Medical Centre · outpatient encounter" },
    { date: "23 Sep 2026", title: "Claim submitted and assessed", detail: "Original bill total KES 36,100" },
    { date: "24 Sep 2026", title: "Provider correction", detail: "Corrected eligible amount KES 29,700" },
    { date: "25 Sep 2026", title: "Adjudication", detail: "Fixture reference date; reviewer event details are not supplied" },
    { date: "02 Oct 2026", title: "Payment reference", detail: "Expected insurer share KES 26,730; bank confirmation not supplied" },
  ],
};

export type ReferenceCase = typeof case001;
export const referenceCases: ReferenceCase[] = [case001,
  { ...case001, fixtureId: "REFERENCE-CASE-002", member: "Amina Otieno", provider: "Kilimani Family Clinic", policy: "POL-HHA-COM-02", contract: "CON-HHA-02", authorization: "Not required", serviceDate: "28 Sep 2026", status: "Approved / awaiting payment", workflow: "Straight-through outpatient approval", billed: 4800, correction: 0, eligible: 4800, memberShare: 480, insurerShare: 4320, remainingBenefit: 455680, variance: 4320, lines: [{ id: "L01", service: "Consultation and medication", billed: 4800, correction: 0, eligible: 4800, basis: "Within benefit" }], timeline: [{ date: "28 Sep 2026", title: "Claim submitted", detail: "Outpatient bill received" }, { date: "29 Sep 2026", title: "Approved", detail: "Awaiting finance payment record" }] },
  { ...case001, fixtureId: "REFERENCE-CASE-003", member: "Wanjiku Wambui", provider: "Westlands Community Hospital", policy: "POL-HHA-MAT-03", contract: "CON-HHA-03", authorization: "AUTH-HHA-003", serviceDate: "30 Sep 2026", status: "Authorization pending", workflow: "Inpatient preauthorization", billed: 84000, correction: 0, eligible: 0, memberShare: 0, insurerShare: 0, remainingBenefit: 250000, variance: 0, lines: [{ id: "L01", service: "Inpatient maternity estimate", billed: 84000, correction: 0, eligible: 0, basis: "Awaiting authorization decision" }], timeline: [{ date: "30 Sep 2026", title: "Authorization requested", detail: "Inpatient service awaits insurer decision" }] },
  { ...case001, fixtureId: "REFERENCE-CASE-004", member: "Brian Kiptoo", provider: "Parklands Specialist Centre", policy: "POL-HHA-OUT-01", contract: "CON-HHA-04", authorization: "Not supplied", serviceDate: "01 Oct 2026", status: "Clarification requested", workflow: "Missing clinical evidence", billed: 12600, correction: 0, eligible: 0, memberShare: 0, insurerShare: 0, remainingBenefit: 100000, variance: 0, lines: [{ id: "L01", service: "Specialist consultation and tests", billed: 12600, correction: 0, eligible: 0, basis: "Clinical notes requested" }], timeline: [{ date: "01 Oct 2026", title: "Claim received", detail: "Supporting clinical notes absent" }, { date: "03 Oct 2026", title: "Clarification requested", detail: "Provider response pending" }] },
  { ...case001, fixtureId: "REFERENCE-CASE-005", member: "Mercy Njeri", provider: "Thika Road Medical Centre", policy: "POL-HHA-COM-02", contract: "CON-HHA-05", authorization: "Not required", serviceDate: "02 Oct 2026", status: "Appeal open", workflow: "Duplicate-line dispute", billed: 9400, correction: 2500, eligible: 6900, memberShare: 690, insurerShare: 6210, remainingBenefit: 493790, variance: 6210, lines: [{ id: "L01", service: "Consultation and diagnostics", billed: 6900, correction: 0, eligible: 6900, basis: "Within benefit" }, { id: "L02", service: "Repeat diagnostic test", billed: 2500, correction: 2500, eligible: 0, basis: "Duplicate-line finding disputed by provider" }], timeline: [{ date: "02 Oct 2026", title: "Claim submitted", detail: "Two bill lines" }, { date: "04 Oct 2026", title: "Adjustment proposed", detail: "Duplicate-line finding" }, { date: "06 Oct 2026", title: "Appeal opened", detail: "Provider disputed duplicate finding" }] },
  { ...case001, fixtureId: "REFERENCE-CASE-006", member: "Joseph Omondi", provider: "Ruiru Family Hospital", policy: "POL-HHA-MAT-03", contract: "CON-HHA-06", authorization: "AUTH-HHA-006", serviceDate: "03 Oct 2026", status: "Partially reconciled", workflow: "Payment shortfall", billed: 58000, correction: 8000, eligible: 50000, memberShare: 5000, insurerShare: 45000, remainingBenefit: 200000, variance: 15000, lines: [{ id: "L01", service: "Approved procedure", billed: 58000, correction: 8000, eligible: 50000, basis: "Contracted tariff" }], timeline: [{ date: "03 Oct 2026", title: "Claim submitted", detail: "Procedure bill received" }, { date: "05 Oct 2026", title: "Approved", detail: "Payable KES 45,000" }, { date: "08 Oct 2026", title: "Partial receipt matched", detail: "KES 30,000 received; KES 15,000 outstanding" }] },
];

export function kes(value: number) {
  return `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value)}`;
}

export const ruleBasis = [
  { title: "Agreed tariff", detail: "Consultation, CBC and MRI adjustments", version: "Version not supplied by fixture", tone: "blue" },
  { title: "Authorization ceiling", detail: "MRI brain without contrast · ceiling KES 25,000", version: "AUTH-HHA-001 · service date 22 Sep 2026", tone: "violet" },
  { title: "Duplicate service", detail: "Duplicate CBC line removed once", version: "Rule version not supplied by fixture", tone: "amber" },
  { title: "Excluded service", detail: "Administration fee is not eligible in this case", version: "Rule version not supplied by fixture", tone: "rose" },
];
