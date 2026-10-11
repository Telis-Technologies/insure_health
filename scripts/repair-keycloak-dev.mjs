/** Repair the loopback realm and provision local role-specific identities. */
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
if (client.attributes?.["post.logout.redirect.uris"] !== "http://localhost:3000/*") {
  await admin("PUT", `clients/${client.id}`, { ...client, attributes: { ...client.attributes, "post.logout.redirect.uris": "http://localhost:3000/*" } });
  console.log("Configured the local post-logout redirect URI.");
}
const realm = await admin("GET", "");
if (realm.loginTheme !== "claimwise") {
  await admin("PUT", "", { ...realm, loginTheme: "claimwise" });
  console.log("Applied Claimwise login theme.");
}
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
const tenantAttributes = { tenant_ids: ["harbor-health-assurance"], organization_ids: ["harbor-health-assurance"], organization_name: ["Harbor Health Assurance"] };
const localUsers = [
  ["lameck", "Lameck", "Administrator", "tenant-administrators", tenantAttributes],
  ["grace.wanjiku", "Grace", "Wanjiku", "provider-billing", { ...tenantAttributes, organization_ids: ["PRO-HHA-01"], organization_name: ["Riverside Medical Centre"] }],
  ["joseph.otieno", "Joseph", "Otieno", "tpa-reviewers", { ...tenantAttributes, organization_ids: ["medibridge-administrators"], organization_name: ["MediBridge Administrators"] }],
  ["mercy.kamau", "Mercy", "Kamau", "insurer-claims-adjudicators", tenantAttributes],
  ["peter.mutua", "Peter", "Mutua", "insurer-claims-approvers", tenantAttributes],
  ["faith.njeri", "Faith", "Njeri", "insurer-finance", tenantAttributes],
  ["sarah.wambui", "Sarah", "Wambui", "insurer-policy-authors", tenantAttributes],
  ["david.ochieng", "David", "Ochieng", "insurer-policy-approvers", tenantAttributes],
  ["naomi.chebet", "Naomi", "Chebet", "auditors", tenantAttributes],
  ["felix.mwangi", "Felix", "Mwangi", "platform-administrators", {}],
];
for (const [username, firstName, lastName, groupName, attributes] of localUsers) {
  const groupId = groupByName.get(groupName);
  if (!groupId) throw new Error(`Missing imported group: ${groupName}`);
  let user = (await admin("GET", `users?username=${encodeURIComponent(username)}&exact=true`))[0];
  const created = !user;
  if (created) {
    await admin("POST", "users", { username, firstName, lastName, email: `${username}@example.test`, enabled: true, emailVerified: true, attributes });
    user = (await admin("GET", `users?username=${encodeURIComponent(username)}&exact=true`))[0];
    console.log(`Created local user: ${username}`);
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
  if (created) await admin("PUT", `users/${user.id}/reset-password`, { type: "password", value: demoPassword, temporary: false });
}
console.log("Local Keycloak realm repaired. Usernames are documented in frontend/README.md; new-account passwords are in ignored .env.demo. Existing passwords were not changed.");
