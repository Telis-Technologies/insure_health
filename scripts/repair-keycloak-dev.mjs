/** Repair an already-imported local realm and provision synthetic demo identities. */
import { readFile } from "node:fs/promises";

const base = new URL(process.env.KEYCLOAK_BASE_URL || "http://127.0.0.1:8080");
if (!(["localhost", "127.0.0.1"].includes(base.hostname) && base.protocol === "http:" && process.env.APP_ENV !== "production")) {
  throw new Error("This script is restricted to a loopback, non-production Keycloak instance.");
}

const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME;
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;
const demoPassword = process.env.CLAIMWISE_DEMO_PASSWORD;
if (!adminUsername || !adminPassword || !demoPassword || demoPassword.length < 16) {
  throw new Error("Set KEYCLOAK_ADMIN_USERNAME, KEYCLOAK_ADMIN_PASSWORD and a 16+ character CLAIMWISE_DEMO_PASSWORD.");
}

const realmConfig = JSON.parse(await readFile(new URL("../infra/keycloak/claimwise-realm.json", import.meta.url), "utf8"));
const tokenResponse = await fetch(new URL("/realms/master/protocol/openid-connect/token", base), {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: adminUsername, password: adminPassword }),
});
if (!tokenResponse.ok) throw new Error(`Keycloak admin sign-in failed (${tokenResponse.status}). Check the ignored root .env.`);
const { access_token: adminToken } = await tokenResponse.json();

async function admin(method, path, body) {
  const response = await fetch(new URL(`/admin/realms/claimwise/${path}`, base), {
    method,
    headers: { authorization: `Bearer ${adminToken}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  return response.status === 204 || response.status === 201 ? null : response.json();
}

const existingScopes = await admin("GET", "client-scopes");
const scopesByName = new Map(existingScopes.map((scope) => [scope.name, scope]));
for (const wanted of realmConfig.clientScopes) {
  if (!scopesByName.has(wanted.name)) {
    await admin("POST", "client-scopes", wanted);
    console.log(`Created OIDC scope: ${wanted.name}`);
  }
}
const scopes = await admin("GET", "client-scopes");
const client = (await admin("GET", "clients?clientId=claimwise-web"))[0];
if (!client) throw new Error("claimwise-web client is absent from the imported realm.");
const attachedScopes = new Set((await admin("GET", `clients/${client.id}/default-client-scopes`)).map((scope) => scope.id));
for (const name of ["profile", "email", "roles", "claimwise-tenant-context"]) {
  const scope = scopes.find((candidate) => candidate.name === name);
  if (!scope) throw new Error(`Missing scope ${name}`);
  const wanted = realmConfig.clientScopes.find((candidate) => candidate.name === name);
  const mappers = await admin("GET", `client-scopes/${scope.id}/protocol-mappers/models`);
  for (const mapper of wanted.protocolMappers || []) {
    if (!mappers.some((existing) => existing.name === mapper.name)) {
      await admin("POST", `client-scopes/${scope.id}/protocol-mappers/models`, mapper);
    }
  }
  if (!attachedScopes.has(scope.id)) {
    await admin("PUT", `clients/${client.id}/default-client-scopes/${scope.id}`);
    console.log(`Attached default scope: ${name}`);
  }
}

const userProfile = await admin("GET", "users/profile");
let profileChanged = false;
for (const [name, multivalued] of [["tenant_ids", true], ["organization_ids", true], ["organization_name", false]]) {
  if (!userProfile.attributes.some((attribute) => attribute.name === name)) {
    userProfile.attributes.push({
      name,
      displayName: name.replaceAll("_", " "),
      multivalued,
      permissions: { view: ["admin"], edit: ["admin"] },
    });
    profileChanged = true;
  }
}
if (profileChanged) {
  await admin("PUT", "users/profile", userProfile);
  console.log("Registered admin-managed tenant and organization attributes.");
}

const groups = await admin("GET", "groups?briefRepresentation=false&max=100");
const groupByName = new Map(groups.map((group) => [group.name, group.id]));
const tenantAttributes = { tenant_ids: ["demo-health-insurer"], organization_ids: ["demo-insurer"], organization_name: ["Harbor Health Assurance (synthetic)"] };
const demoUsers = [
  ["lameck", "Lameck", "Demo", "tenant-administrators", tenantAttributes],
  ["provider.demo", "Provider", "Biller", "provider-billing", { ...tenantAttributes, organization_ids: ["DEMO-PRO-01"], organization_name: ["Synthetic Health Facility 01"] }],
  ["reviewer.demo", "TPA", "Reviewer", "tpa-reviewers", { ...tenantAttributes, organization_ids: ["demo-tpa"], organization_name: ["MediBridge Administrators (synthetic)"] }],
  ["adjudicator.demo", "Claims", "Adjudicator", "insurer-claims-adjudicators", tenantAttributes],
  ["approver.demo", "Claims", "Approver", "insurer-claims-approvers", tenantAttributes],
  ["finance.demo", "Insurer", "Finance", "insurer-finance", tenantAttributes],
  ["policy.author.demo", "Policy", "Author", "insurer-policy-authors", tenantAttributes],
  ["policy.approver.demo", "Policy", "Approver", "insurer-policy-approvers", tenantAttributes],
  ["auditor.demo", "Tenant", "Auditor", "auditors", tenantAttributes],
  ["platform.demo", "Platform", "Admin", "platform-administrators", {}],
];
for (const [username, firstName, lastName, groupName, attributes] of demoUsers) {
  const groupId = groupByName.get(groupName);
  if (!groupId) throw new Error(`Missing imported group: ${groupName}`);
  let user = (await admin("GET", `users?username=${encodeURIComponent(username)}&exact=true`))[0];
  if (!user) {
    await admin("POST", "users", { username, firstName, lastName, email: `${username}@example.test`, enabled: true, emailVerified: true, attributes });
    user = (await admin("GET", `users?username=${encodeURIComponent(username)}&exact=true`))[0];
    console.log(`Created synthetic user: ${username}`);
  }
  await admin("PUT", `users/${user.id}`, {
    username,
    firstName,
    lastName,
    email: `${username}@example.test`,
    emailVerified: true,
    enabled: true,
    attributes,
  });
  await admin("PUT", `users/${user.id}/groups/${groupId}`);
  await admin("PUT", `users/${user.id}/reset-password`, { type: "password", value: demoPassword, temporary: false });
}
console.log("Local Keycloak realm repaired. Demo usernames are documented in frontend/README.md; their password is in ignored .env.demo.");
