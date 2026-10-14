import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export type ClaimStatus = "Draft" | "Submitted" | "Needs correction" | "Resubmitted" | "Rejected" | "Approved";
export type DocumentKind = "Signed claim form" | "Receipt / invoice" | "Clinical report" | "Pre-authorization" | "Other evidence";
export type Finding = { id: string; code: string; title: string; outcome: "pass" | "issue" | "review"; message: string; ruleVersion: string; sourceClause: string; evidence: string };
export type Evidence = { id: string; name: string; kind: DocumentKind; size: number; extractionStatus: "sample ready" | "processing" | "ready" | "manual review" | "failed"; extractedText: string; extractedFields: Record<string,string>; downloadUrl?: string };
export type Activity = { id: string; message: string; actor: string; at: string };
export type Claim = { id: string; member: string; provider: string; policy: string; policyVersion: string; service: string; serviceDate: string; amount: number; payableAmount?: number; approvedClaimVersion?: number; status: ClaimStatus; note: string; version: number; evidence: Evidence[]; findings: Finding[]; activity: Activity[] };
export type PolicyVersion = { id: string; name: string; version: string; state: "Active" | "Draft" | "Superseded"; effectiveFrom: string; config: { outpatientLimit: number; annualLimit: number; copayPercent: number; authorizationThreshold: number }; createdAt: string };
type RuleConfig = PolicyVersion["config"];
const sampleRuleConfig: RuleConfig = { outpatientLimit: 25000, annualLimit: 500000, copayPercent: 10, authorizationThreshold: 50000 };

const globalPool = globalThis as typeof globalThis & { claimwisePool?: Pool; claimwiseSchema?: Promise<void> };
function pool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Start the MVP database and configure frontend/.env.local.");
  globalPool.claimwisePool ??= new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 2_000 });
  return globalPool.claimwisePool;
}

const schema = `
CREATE TABLE IF NOT EXISTS mvp_claims (
  id text PRIMARY KEY, member text NOT NULL, provider text NOT NULL, policy text NOT NULL,
  policy_version text NOT NULL, service text NOT NULL, service_date date NOT NULL, amount integer NOT NULL,
  payable_amount integer, approved_claim_version integer, status text NOT NULL, note text NOT NULL DEFAULT '', current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mvp_claims ADD COLUMN IF NOT EXISTS payable_amount integer;
ALTER TABLE mvp_claims ADD COLUMN IF NOT EXISTS approved_claim_version integer;
CREATE TABLE IF NOT EXISTS mvp_claim_versions (
  claim_id text NOT NULL REFERENCES mvp_claims(id), version integer NOT NULL, snapshot jsonb NOT NULL,
  actor text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(claim_id, version)
);
CREATE TABLE IF NOT EXISTS mvp_documents (
  id text PRIMARY KEY, claim_id text NOT NULL REFERENCES mvp_claims(id), file_name text NOT NULL,
  kind text NOT NULL, mime text NOT NULL, size_bytes bigint NOT NULL, storage_path text,
  extraction_status text NOT NULL, extracted_text text NOT NULL DEFAULT '', extracted_fields jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mvp_findings (
  id text PRIMARY KEY, claim_id text NOT NULL REFERENCES mvp_claims(id), claim_version integer NOT NULL,
  code text NOT NULL, title text NOT NULL, outcome text NOT NULL, message text NOT NULL,
  rule_version text NOT NULL, source_clause text NOT NULL, evidence text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mvp_activity (
  id text PRIMARY KEY, claim_id text NOT NULL REFERENCES mvp_claims(id), message text NOT NULL,
  actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mvp_policy_versions (
  id text PRIMARY KEY, name text NOT NULL, version text NOT NULL, state text NOT NULL,
  effective_from date NOT NULL, config jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);
CREATE INDEX IF NOT EXISTS mvp_claims_updated_idx ON mvp_claims(updated_at DESC);
CREATE INDEX IF NOT EXISTS mvp_findings_claim_version_idx ON mvp_findings(claim_id, claim_version);
`;

const initialClaims = [
  { id: "CLM-1048", member: "Daniel Mwangi", provider: "Riverside Medical Centre", policy: "Afya Comprehensive", policyVersion: "3.2", service: "MRI brain + consultation", date: "2026-10-14", amount: 36100, status: "Needs correction" as ClaimStatus, note: "Radiologist report is required to support the MRI line.", docs: [["Signed claim form", "Claim form · CLM-1048.pdf"], ["Receipt / invoice", "Invoice · CLM-1048.pdf"]] as [DocumentKind, string][] },
  { id: "CLM-1047", member: "Amina Otieno", provider: "Kilimani Family Clinic", policy: "Afya Comprehensive", policyVersion: "3.2", service: "Outpatient consultation", date: "2026-10-14", amount: 4800, status: "Submitted" as ClaimStatus, note: "All required intake evidence received.", docs: [["Signed claim form", "Claim form · CLM-1047.pdf"], ["Receipt / invoice", "Invoice · CLM-1047.pdf"], ["Clinical report", "Consultation notes · CLM-1047.pdf"]] as [DocumentKind, string][] },
  { id: "CLM-1046", member: "Wanjiku Wambui", provider: "Westlands Community Hospital", policy: "Afya Comprehensive", policyVersion: "3.2", service: "Maternity admission", date: "2026-10-13", amount: 84000, status: "Resubmitted" as ClaimStatus, note: "Discharge summary added after clarification request.", docs: [["Signed claim form", "Claim form · CLM-1046.pdf"], ["Receipt / invoice", "Invoice · CLM-1046.pdf"], ["Clinical report", "Discharge summary · CLM-1046.pdf"], ["Pre-authorization", "AUTH-8821.pdf"]] as [DocumentKind, string][] },
  { id: "CLM-1045", member: "Brian Kiptoo", provider: "Parklands Specialist Centre", policy: "Afya Comprehensive", policyVersion: "3.2", service: "Specialist consultation", date: "2026-10-13", amount: 12600, status: "Rejected" as ClaimStatus, note: "Service date falls outside the member's active benefit period.", docs: [["Signed claim form", "Claim form · CLM-1045.pdf"], ["Receipt / invoice", "Invoice · CLM-1045.pdf"]] as [DocumentKind, string][] },
  { id: "CLM-1044", member: "Mercy Njeri", provider: "Thika Road Medical Centre", policy: "Afya Comprehensive", policyVersion: "3.2", service: "Diagnostics", date: "2026-10-12", amount: 9400, status: "Approved" as ClaimStatus, note: "Approved payable KES 6,900 after the configured tariff check.", docs: [["Signed claim form", "Claim form · CLM-1044.pdf"], ["Receipt / invoice", "Invoice · CLM-1044.pdf"], ["Clinical report", "Lab results · CLM-1044.pdf"]] as [DocumentKind, string][] },
];

async function ensureSchema() {
  globalPool.claimwiseSchema ??= (async () => {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query(schema);
      const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM mvp_claims");
      if (count.rows[0].count === "0") await seed(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      globalPool.claimwiseSchema = undefined;
      throw error;
    } finally { client.release(); }
  })();
  return globalPool.claimwiseSchema;
}

async function seed(client: PoolClient) {
  await client.query(`INSERT INTO mvp_policy_versions (id,name,version,state,effective_from,config) VALUES
    ('POL-AFYA-32','Afya Comprehensive','3.2','Active','2026-01-01',$1::jsonb),
    ('POL-AFYA-33','Afya Comprehensive','3.3','Draft','2027-01-01',$2::jsonb)`, [
    JSON.stringify({ outpatientLimit: 25000, annualLimit: 500000, copayPercent: 10, authorizationThreshold: 50000 }),
    JSON.stringify({ outpatientLimit: 30000, annualLimit: 550000, copayPercent: 10, authorizationThreshold: 50000 }),
  ]);
  for (const item of initialClaims) {
    await client.query(`INSERT INTO mvp_claims (id,member,provider,policy,policy_version,service,service_date,amount,status,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [item.id,item.member,item.provider,item.policy,item.policyVersion,item.service,item.date,item.amount,item.status,item.note]);
    const docs = item.docs.map(([kind, name]) => ({ id: randomUUID(), name, kind, size: 0, status: "sample ready", text: "Preloaded reference evidence for the investor walkthrough." }));
    for (const doc of docs) await client.query(`INSERT INTO mvp_documents (id,claim_id,file_name,kind,mime,size_bytes,extraction_status,extracted_text) VALUES ($1,$2,$3,$4,'application/pdf',0,$5,$6)`, [doc.id,item.id,doc.name,doc.kind,doc.status,doc.text]);
    const claim = { ...item, version: 1 };
    await client.query("INSERT INTO mvp_claim_versions (claim_id,version,snapshot,actor,action) VALUES ($1,1,$2::jsonb,'system','seed')", [item.id,JSON.stringify(claim)]);
    await addActivity(client,item.id,"Claim received from provider · sample case","Provider billing");
    if (item.status === "Needs correction") await addActivity(client,item.id,"Reviewer requested the radiologist report","Claims reviewer");
    if (item.status === "Resubmitted") await addActivity(client,item.id,"Provider responded and resubmitted the claim","Provider billing");
    if (item.status === "Rejected") await addActivity(client,item.id,"Claim rejected · benefit period not active on service date","Claims reviewer");
    if (item.status === "Approved") await addActivity(client,item.id,"Claim approved for the configured payable amount","Claims reviewer");
    const findings = evaluateClaim({ ...item, evidence: docs.map(d => ({ kind:d.kind })) },sampleRuleConfig,"3.2");
    if(item.status==="Rejected"){
      const eligibility=findings.find(f=>f.code==="ELIG-01")!;
      eligibility.outcome="issue";
      eligibility.message="Service date is outside the member's benefit period in this reference case.";
      eligibility.evidence="Member benefit-period dates compared with the service date";
    }
    for (const finding of findings) await insertFinding(client,item.id,1,finding);
  }
}

async function addActivity(client: PoolClient, claimId: string, message: string, actor: string) {
  await client.query("INSERT INTO mvp_activity (id,claim_id,message,actor) VALUES ($1,$2,$3,$4)",[randomUUID(),claimId,message,actor]);
}
async function insertFinding(client: PoolClient, claimId: string, version: number, finding: Omit<Finding,"id"> & { id?: string }) {
  await client.query(`INSERT INTO mvp_findings (id,claim_id,claim_version,code,title,outcome,message,rule_version,source_clause,evidence)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[finding.id ?? randomUUID(),claimId,version,finding.code,finding.title,finding.outcome,finding.message,finding.ruleVersion,finding.sourceClause,finding.evidence]);
}

async function applicablePolicy(client:PoolClient,name:string,serviceDate:string){
  const result=await client.query("SELECT version,config FROM mvp_policy_versions WHERE name=$1 AND state IN ('Active','Superseded') AND effective_from<=$2::date ORDER BY effective_from DESC LIMIT 1",[name,serviceDate]);
  if(!result.rowCount) throw new Error("No published policy version applies on this service date.");
  return {version:String(result.rows[0].version),config:result.rows[0].config as RuleConfig};
}

export function evaluateClaim(claim: { member: string; policy: string; amount: number; service: string; evidence: { kind: string }[] },config:RuleConfig=sampleRuleConfig,version="3.2"): Omit<Finding,"id">[] {
  const kinds = new Set(claim.evidence.map((document) => document.kind));
  const radiologyNeeded = /mri|x-ray|radiolog/i.test(claim.service);
  const hasRadiology = [...kinds].some((kind) => /clinical report/i.test(kind));
  const benefitLimit=/outpatient/i.test(claim.service)?config.outpatientLimit:config.annualLimit;
  const authorizationRequired=claim.amount>=config.authorizationThreshold;
  return [
    { code:"ELIG-01",title:"Member & benefit-period eligibility",outcome:/outside|inactive/i.test(claim.member) ? "issue":"pass",message:/outside|inactive/i.test(claim.member) ? "Member benefit period is not active on the service date.":`${claim.member} is active for the service date in this sample case.`,ruleVersion:version,sourceClause:"Eligibility §1.1",evidence:"Member record and service date" },
    { code:"BEN-04",title:"Benefit limit",outcome:claim.amount<=benefitLimit?"pass":"issue",message:claim.amount<=benefitLimit?`Claim amount is within the configured sample benefit limit of KES ${benefitLimit.toLocaleString("en-KE")}.`:`Claim amount exceeds the configured sample benefit limit of KES ${benefitLimit.toLocaleString("en-KE")}.`,ruleVersion:version,sourceClause:/outpatient/i.test(claim.service)?"Outpatient benefit §2.3":"Annual benefit §2.1",evidence:`Claimed amount KES ${claim.amount.toLocaleString("en-KE")}` },
    { code:"DOC-02",title:"Signed claim form & invoice",outcome:kinds.has("Signed claim form") && kinds.has("Receipt / invoice") ? "pass":"issue",message:kinds.has("Signed claim form") && kinds.has("Receipt / invoice") ? "Signed claim form and itemized invoice are attached.":"Signed claim form and receipt/invoice are both required.",ruleVersion:version,sourceClause:"Claims submission §4.1",evidence:"Attached document list" },
    { code:"CLIN-07",title:"Clinical support for service",outcome:!radiologyNeeded || hasRadiology ? "pass":"issue",message:!radiologyNeeded || hasRadiology ? "Supporting clinical evidence is present or not required by this sample rule.":"Attach the radiologist report to support the MRI / radiology line.",ruleVersion:version,sourceClause:"Diagnostic services §5.2",evidence:"Service line and clinical-report attachment" },
    { code:"TAR-01",title:"Provider tariff",outcome:"pass",message:"Configured provider tariff reference found for this sample service.",ruleVersion:version,sourceClause:"Provider tariff schedule §3.1",evidence:"Service line and provider contract" },
    { code:"COPAY-02",title:"Member cost share",outcome:"pass",message:`Configured member co-pay is ${config.copayPercent}% under this sample version.`,ruleVersion:version,sourceClause:"Member cost share §2.5",evidence:`Claim amount KES ${claim.amount.toLocaleString("en-KE")}` },
    { code:"AUTH-03",title:"Pre-authorization",outcome:!authorizationRequired || kinds.has("Pre-authorization") ? "pass":"review",message:!authorizationRequired || kinds.has("Pre-authorization") ? "No additional authorization check is triggered by this sample rule.":`Amount reaches the configured ${new Intl.NumberFormat("en-KE").format(config.authorizationThreshold)} KES authorization threshold; reviewer confirmation is required.`,ruleVersion:version,sourceClause:"Prior approval §6.1",evidence:"Claim amount and authorization attachment" },
  ];
}

async function snapshot(client: PoolClient, claimId: string, actor: string, action: string) {
  const result = await client.query("SELECT * FROM mvp_claims WHERE id=$1 FOR UPDATE",[claimId]);
  if (!result.rowCount) return null;
  const c = result.rows[0];
  const version = Number(c.current_version) + 1;
  await client.query("UPDATE mvp_claims SET current_version=$2,updated_at=now() WHERE id=$1",[claimId,version]);
  const value = { id:c.id,member:c.member,provider:c.provider,policy:c.policy,policyVersion:c.policy_version,service:c.service,serviceDate:c.service_date,amount:c.amount,payableAmount:c.payable_amount,approvedClaimVersion:c.approved_claim_version,status:c.status,note:c.note,version };
  await client.query("INSERT INTO mvp_claim_versions (claim_id,version,snapshot,actor,action) VALUES ($1,$2,$3::jsonb,$4,$5)",[claimId,version,JSON.stringify(value),actor,action]);
  return version;
}

export async function listClaims(): Promise<Claim[]> {
  await ensureSchema();
  const db = pool();
  const [claims, docs, findings, activity] = await Promise.all([
    db.query("SELECT mvp_claims.*, to_char(service_date, 'YYYY-MM-DD') AS service_date_iso FROM mvp_claims ORDER BY updated_at DESC,id"),
    db.query("SELECT id,claim_id,file_name,kind,size_bytes,extraction_status,extracted_text FROM mvp_documents ORDER BY created_at"),
    db.query("SELECT id,claim_id,claim_version,code,title,outcome,message,rule_version,source_clause,evidence FROM mvp_findings ORDER BY created_at"),
    db.query("SELECT id,claim_id,message,actor,created_at FROM mvp_activity ORDER BY created_at"),
  ]);
  return claims.rows.map((c) => ({
    id:c.id,member:c.member,provider:c.provider,policy:c.policy,policyVersion:c.policy_version,service:c.service,serviceDate:c.service_date_iso,amount:Number(c.amount),payableAmount:c.payable_amount==null?undefined:Number(c.payable_amount),approvedClaimVersion:c.approved_claim_version==null?undefined:Number(c.approved_claim_version),status:c.status,note:c.note,version:Number(c.current_version),
    evidence:docs.rows.filter((d) => d.claim_id===c.id).map((d) => ({ id:d.id,name:d.file_name,kind:d.kind,size:Number(d.size_bytes),extractionStatus:d.extraction_status,extractedText:d.extracted_text,extractedFields:d.extracted_fields??{},downloadUrl:d.extraction_status==="sample ready" ? undefined:`/api/documents/${d.id}` })),
    findings:findings.rows.filter((f) => f.claim_id===c.id && Number(f.claim_version)===Number(c.current_version)).map((f) => ({ id:f.id,code:f.code,title:f.title,outcome:f.outcome,message:f.message,ruleVersion:f.rule_version,sourceClause:f.source_clause,evidence:f.evidence })),
    activity:activity.rows.filter((a) => a.claim_id===c.id).map((a) => ({ id:a.id,message:a.message,actor:a.actor,at:new Date(a.created_at).toISOString() })),
  }));
}

export async function createClaim(input: { member: string; provider: string; policy: string; service: string; serviceDate: string; amount: number; status?: ClaimStatus; note?: string }, actor="Provider billing") {
  await ensureSchema();
  if (!input.member || !input.provider || !input.policy || !input.service || !input.serviceDate || !Number.isFinite(input.amount) || input.amount<=0) throw new Error("Complete all claim details and enter a positive amount.");
  const id=`CLM-${Math.floor(Date.now()/1000).toString().slice(-5)}${randomUUID().slice(0,3).toUpperCase()}`;
  const client=await pool().connect();
  try {
    await client.query("BEGIN");
    const applicable=await applicablePolicy(client,input.policy,input.serviceDate);
    await client.query(`INSERT INTO mvp_claims (id,member,provider,policy,policy_version,service,service_date,amount,status,note,current_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)`,[id,input.member,input.provider,input.policy,applicable.version,input.service,input.serviceDate,input.amount,input.status??"Submitted",input.note??"Claim submitted for review."]);
    await client.query("INSERT INTO mvp_claim_versions (claim_id,version,snapshot,actor,action) VALUES ($1,1,$2::jsonb,$3,'claim created')",[id,JSON.stringify({...input,id,policyVersion:applicable.version,version:1}),actor]);
    await addActivity(client,id,input.status==="Draft"?"Claim draft created · add documents and submit":"Claim submitted by provider",actor);
    await client.query("COMMIT");
    return id;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function submitClaim(claimId: string, input: { member: string; provider: string; policy: string; service: string; serviceDate: string; amount: number }, actor="Provider billing") {
  await ensureSchema();
  const client=await pool().connect();
  try {
    await client.query("BEGIN");
    const before=await client.query("SELECT * FROM mvp_claims WHERE id=$1 FOR UPDATE",[claimId]);
    if (!before.rowCount) throw new Error("Claim not found.");
    const applicable=await applicablePolicy(client,input.policy,input.serviceDate);
    const docs=await client.query("SELECT kind FROM mvp_documents WHERE claim_id=$1",[claimId]);
    const evidence=docs.rows.map((d)=>({kind:d.kind}));
    const findings=evaluateClaim({...input,evidence},applicable.config,applicable.version);
    const status: ClaimStatus=findings.some(f=>f.outcome==="issue")?"Needs correction":"Submitted";
    const note=status==="Needs correction"?findings.find(f=>f.outcome==="issue")!.message:"Claim submitted · assessment complete.";
    await client.query(`UPDATE mvp_claims SET member=$2,provider=$3,policy=$4,policy_version=$5,service=$6,service_date=$7,amount=$8,status=$9,note=$10 WHERE id=$1`,[claimId,input.member,input.provider,input.policy,applicable.version,input.service,input.serviceDate,input.amount,status,note]);
    const version=await snapshot(client,claimId,actor,"provider confirmed extracted fields and submitted");
    for (const finding of findings) await insertFinding(client,claimId,version!,finding);
    await addActivity(client,claimId,`Provider confirmed claim details and submitted · policy version ${applicable.version}`,actor);
    await client.query("COMMIT");
    return status;
  } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
}

export async function recordAction(claimId: string, input: { action: "request_correction"|"reject"|"approve"|"resubmit"; note: string }, actor: "Provider billing"|"Claims reviewer") {
  await ensureSchema();
  const client=await pool().connect();
  try {
    await client.query("BEGIN");
    const got=await client.query("SELECT * FROM mvp_claims WHERE id=$1 FOR UPDATE",[claimId]);
    if (!got.rowCount) throw new Error("Claim not found.");
    const c=got.rows[0]; let status: ClaimStatus; let message=input.note.trim();
    if (!message) throw new Error("Add a clear reason or response before continuing.");
    if (input.action==="request_correction" || input.action==="reject") {
      if (actor!=="Claims reviewer") throw new Error("Only the reviewer persona can take this action.");
      status=input.action==="reject"?"Rejected":"Needs correction";
    } else if (input.action==="approve") {
      if (actor!=="Claims reviewer") throw new Error("Only the reviewer persona can approve a claim.");
      if (!["Submitted","Resubmitted"].includes(c.status)) throw new Error("Only submitted claims can be approved.");
      const blocking=await client.query("SELECT 1 FROM mvp_findings WHERE claim_id=$1 AND claim_version=$2 AND outcome='issue'",[claimId,c.current_version]);
      if (blocking.rowCount) throw new Error("Resolve blocking rule findings before approval.");
      status="Approved";
      const policy=await client.query("SELECT config FROM mvp_policy_versions WHERE name=$1 AND version=$2",[c.policy,c.policy_version]);
      const copay=Number(policy.rows[0]?.config?.copayPercent ?? 0);
      const payable=Math.round(Number(c.amount)*(100-copay)/100);
      await client.query("UPDATE mvp_claims SET payable_amount=$2,approved_claim_version=$3 WHERE id=$1",[claimId,payable,Number(c.current_version)]);
      message=`${message} · payable ${new Intl.NumberFormat("en-KE").format(payable)} KES · approved claim version ${c.current_version}`;
    } else {
      if (actor!=="Provider billing") throw new Error("Only the provider persona can respond and resubmit.");
      if (!["Needs correction","Rejected"].includes(c.status)) throw new Error("This claim is not awaiting a provider response.");
      status="Resubmitted";
    }
    if(input.action==="resubmit"){
      const docs=await client.query("SELECT kind FROM mvp_documents WHERE claim_id=$1",[claimId]);
      const policy=await client.query("SELECT config FROM mvp_policy_versions WHERE name=$1 AND version=$2",[c.policy,c.policy_version]);
      const findings=evaluateClaim({member:c.member,policy:c.policy,amount:Number(c.amount),service:c.service,evidence:docs.rows.map((d)=>({kind:d.kind}))},policy.rows[0]?.config??sampleRuleConfig,String(c.policy_version));
      const issue=findings.find(f=>f.outcome==="issue");
      status=issue?"Needs correction":"Resubmitted";
      if(issue) message=issue.message;
      await client.query("UPDATE mvp_claims SET status=$2,note=$3 WHERE id=$1",[claimId,status,message]);
      const version=await snapshot(client,claimId,actor,input.action);
      for(const finding of findings) await insertFinding(client,claimId,version!,finding);
    } else {
      await client.query("UPDATE mvp_claims SET status=$2,note=$3 WHERE id=$1",[claimId,status,message]);
      const prior=await client.query("SELECT code,title,outcome,message,rule_version,source_clause,evidence FROM mvp_findings WHERE claim_id=$1 AND claim_version=$2",[claimId,c.current_version]);
      const version=await snapshot(client,claimId,actor,input.action);
      for(const finding of prior.rows) await insertFinding(client,claimId,version!,{code:finding.code,title:finding.title,outcome:finding.outcome,message:finding.message,ruleVersion:finding.rule_version,sourceClause:finding.source_clause,evidence:finding.evidence});
    }
    await addActivity(client,claimId,message,actor);
    await client.query("COMMIT");
    return status;
  } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
}

export async function attachDocument(input: { id: string; claimId: string; name: string; kind: DocumentKind; size: number; storagePath: string; mime: string; status: string }, actor="Provider billing") {
  await ensureSchema();
  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const claim=await client.query("SELECT * FROM mvp_claims WHERE id=$1 FOR UPDATE",[input.claimId]);
    if(!claim.rowCount) throw new Error("Claim not found.");
    await client.query(`INSERT INTO mvp_documents (id,claim_id,file_name,kind,mime,size_bytes,storage_path,extraction_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[input.id,input.claimId,input.name,input.kind,input.mime,input.size,input.storagePath,input.status]);
    const version=await snapshot(client,input.claimId,actor,"document attached: "+input.name);
    const docs=await client.query("SELECT kind FROM mvp_documents WHERE claim_id=$1",[input.claimId]);
    const policy=await client.query("SELECT config FROM mvp_policy_versions WHERE name=$1 AND version=$2",[claim.rows[0].policy,claim.rows[0].policy_version]);
    const findings=evaluateClaim({member:claim.rows[0].member,policy:claim.rows[0].policy,amount:Number(claim.rows[0].amount),service:claim.rows[0].service,evidence:docs.rows.map((d)=>({kind:d.kind}))},policy.rows[0]?.config??sampleRuleConfig,String(claim.rows[0].policy_version));
    for(const finding of findings) await insertFinding(client,input.claimId,version!,finding);
    await addActivity(client,input.claimId,`Document attached · ${input.kind} · ${input.name}`,actor);
    await client.query("COMMIT"); return version;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function updateExtraction(id: string, status: string, text: string, fields: Record<string,string>) {
  await ensureSchema();
  await pool().query("UPDATE mvp_documents SET extraction_status=$2,extracted_text=$3,extracted_fields=$4::jsonb WHERE id=$1",[id,status,text,JSON.stringify(fields)]);
}

export async function getDocument(id:string){await ensureSchema();const result=await pool().query("SELECT * FROM mvp_documents WHERE id=$1",[id]);return result.rows[0]??null;}

export async function recordSampleScan(input:{member:string;provider:string;policy:string;service:string;serviceDate:string;amount:number}){
  const id=await createClaim({...input,status:"Draft",note:"Instant reference scan · provider confirmation required."});
  const client=await pool().connect();
  const texts=[
    `CLAIMWISE REFERENCE SCAN\nMember: ${input.member}\nProvider: ${input.provider}\nPolicy: ${input.policy}\nService: ${input.service}\nService date: ${input.serviceDate}\nClaim amount: KES ${input.amount}\nSample rule set: version 3.2`,
    `ITEMIZED RECEIPT\nMember: ${input.member}\nProvider: ${input.provider}\nDate: ${input.serviceDate}\nTotal: KES ${input.amount}`,
  ];
  try{
    await client.query("BEGIN");
    for(const [i,kind] of (["Signed claim form","Receipt / invoice"] as DocumentKind[]).entries()){
      const docId=randomUUID();const name=`Reference scan · ${kind.toLowerCase()} · ${id}.pdf`;
      await client.query(`INSERT INTO mvp_documents (id,claim_id,file_name,kind,mime,size_bytes,extraction_status,extracted_text)
        VALUES ($1,$2,$3,$4,'application/pdf',0,'sample ready',$5)`,[docId,id,name,kind,texts[i]]);
      await addActivity(client,id,`Sample scan extracted · ${kind} · fields require provider confirmation`,"Local extraction");
    }
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  await submitClaim(id,input);
  return id;
}

export async function listPolicies():Promise<PolicyVersion[]>{
  await ensureSchema();const result=await pool().query("SELECT * FROM mvp_policy_versions ORDER BY created_at DESC,version DESC");
  return result.rows.map(r=>({id:r.id,name:r.name,version:r.version,state:r.state,effectiveFrom:String(r.effective_from).slice(0,10),config:r.config,createdAt:new Date(r.created_at).toISOString()}));
}
export async function createPolicyDraft(input:PolicyVersion["config"] & {effectiveFrom:string}){
  await ensureSchema();
  if(!Number.isFinite(input.outpatientLimit)||!Number.isFinite(input.annualLimit)||!Number.isFinite(input.copayPercent)||!Number.isFinite(input.authorizationThreshold)||input.outpatientLimit<0||input.annualLimit<0||input.copayPercent<0||input.copayPercent>100||input.authorizationThreshold<0)throw new Error("Enter valid non-negative policy values; co-pay must be between 0 and 100%.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)||Number.isNaN(Date.parse(`${input.effectiveFrom}T00:00:00Z`)))throw new Error("Choose an effective-from date.");
  const {effectiveFrom,...config}=input;
  const id=randomUUID();const result=await pool().query("SELECT count(*)::int AS n FROM mvp_policy_versions WHERE name='Afya Comprehensive'");const version=`3.${Number(result.rows[0].n)+2}`;
  await pool().query("INSERT INTO mvp_policy_versions(id,name,version,state,effective_from,config) VALUES($1,'Afya Comprehensive',$2,'Draft',$3,$4::jsonb)",[id,version,effectiveFrom,JSON.stringify(config)]);
  return (await listPolicies()).find(p=>p.id===id)!;
}
