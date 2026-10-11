/** Exercise the local Auth.js -> Keycloak -> Auth.js redirect chain over HTTP. */
const password = process.env.CLAIMWISE_DEMO_PASSWORD;
if (!password) throw new Error("Load the ignored .env.demo before running this smoke test.");
const username = process.env.CLAIMWISE_DEMO_USERNAME || "lameck";
const expectedRole = process.env.CLAIMWISE_EXPECTED_ROLE || "tenant-admin";

const cookies = new Map();
async function request(url, options = {}) {
  const target = new URL(url, "http://localhost:3000");
  const jar = cookies.get(target.origin) || new Map();
  const response = await fetch(target, {
    ...options,
    redirect: "manual",
    headers: { ...(jar.size ? { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") } : {}), ...options.headers },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  cookies.set(target.origin, jar);
  return response;
}

const csrfResponse = await request("/api/auth/csrf");
if (!csrfResponse.ok) throw new Error(`Auth.js CSRF endpoint returned ${csrfResponse.status}`);
const { csrfToken } = await csrfResponse.json();
const start = await request("/api/auth/signin/keycloak?prompt=login", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, callbackUrl: "http://localhost:3000/" }),
});
const authorizationUrl = start.headers.get("location");
if (start.status !== 302 || !authorizationUrl?.includes("/realms/claimwise/protocol/openid-connect/auth")) {
  throw new Error(`Auth.js did not redirect to Keycloak: ${start.status}`);
}
if (new URL(authorizationUrl).searchParams.get("prompt") !== "login") {
  throw new Error("The sign-in flow must require account selection after a prior SSO session.");
}

const loginPage = await request(authorizationUrl);
const loginHtml = await loginPage.text();
if (loginPage.status !== 200 || !loginHtml.includes("username") || !loginHtml.includes("password")) {
  throw new Error(`Keycloak did not show its login form: ${loginPage.status} ${loginPage.headers.get("location") || loginHtml.slice(0, 200)}`);
}
const action = loginHtml.match(/<form[^>]*\sid="kc-form-login"[^>]*\saction="([^"]+)"/s)?.[1]
  || loginHtml.match(/<form[^>]*\saction="([^"]+)"[^>]*\sid="kc-form-login"/s)?.[1];
if (!action) throw new Error("Keycloak login form action was not found.");
const formUrl = action.replaceAll("&amp;", "&");
const login = await request(formUrl, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username, password, credentialId: "" }),
});
const callback = login.headers.get("location");
if (login.status !== 302 || !callback?.includes("/api/auth/callback/keycloak")) {
  throw new Error(`Keycloak did not redirect back to Auth.js: ${login.status} ${callback || "(no location)"}`);
}
const signedIn = await request(callback);
if (signedIn.status !== 302 || !signedIn.headers.get("location")?.startsWith("http://localhost:3000")) {
  throw new Error(`Auth.js callback failed: ${signedIn.status} ${signedIn.headers.get("location") || "(no location)"}`);
}
const sessionResponse = await request("/api/auth/session");
const session = await sessionResponse.json();
if (!session.user?.roles?.includes(expectedRole)) {
  throw new Error(`Authenticated session has no ${expectedRole} role: ${JSON.stringify(session.user)}`);
}
if (expectedRole !== "platform-admin" && !session.user?.tenantIds?.includes("harbor-health-assurance")) {
  throw new Error(`Authenticated session has no Harbor Health tenant: ${JSON.stringify(session.user)}`);
}
const home = await request("/");
if (home.status !== 200) throw new Error(`Authenticated home returned ${home.status}`);
const authorizedPath = expectedRole === "tenant-admin" ? "/organization" : expectedRole === "insurer-finance" ? "/settlements" : expectedRole === "provider-biller" ? "/claims/new" : expectedRole === "tpa-reviewer" ? "/reviews" : null;
if (authorizedPath && (await request(authorizedPath)).status !== 200) throw new Error(`${expectedRole} could not access ${authorizedPath}`);
const forbiddenPaths = expectedRole === "tenant-admin" ? ["/reviews", "/settlements", "/claims/new"] : expectedRole === "insurer-finance" ? ["/claims/new", "/reviews"] : expectedRole === "provider-biller" ? ["/settlements", "/reviews"] : expectedRole === "tpa-reviewer" ? ["/settlements", "/claims/new"] : [];
for (const forbiddenPath of forbiddenPaths) {
  const forbidden = await request(forbiddenPath);
  if (![302, 307].includes(forbidden.status) || !forbidden.headers.get("location")?.endsWith("/forbidden")) {
    throw new Error(`${expectedRole} was not denied access to ${forbiddenPath}: ${forbidden.status}`);
  }
}
const signoutCsrf = await (await request("/api/auth/csrf")).json();
const signedOut = await request("/api/auth/signout", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken: signoutCsrf.csrfToken, callbackUrl: "http://localhost:3000/login?logged_out=1" }),
});
if (![200, 302, 303].includes(signedOut.status)) throw new Error(`Auth.js sign-out failed: ${signedOut.status}`);
const afterSignout = await (await request("/api/auth/session")).json();
if (afterSignout?.user) throw new Error("Auth.js retained the previous user's session after sign-out.");
for (const port of [3000, 3001]) {
  const logout = new URL("http://localhost:8080/realms/claimwise/protocol/openid-connect/logout");
  logout.searchParams.set("client_id", "claimwise-web");
  logout.searchParams.set("post_logout_redirect_uri", `http://localhost:${port}/login?logged_out=1`);
  const response = await request(logout);
  const html = await response.text();
  if (response.status >= 400 || html.includes("Invalid redirect uri")) {
    throw new Error(`Keycloak rejected the local post-logout redirect for port ${port}: ${response.status}`);
  }
  if (port === 3000 && html.includes('id="kc-logout-confirm"')) {
    const action = html.match(/<form[^>]*class="form-actions"[^>]*action="([^"]+)"/s)?.[1];
    const sessionCode = html.match(/name="session_code" value="([^"]+)"/)?.[1];
    if (!action || !sessionCode) throw new Error("Keycloak logout confirmation was incomplete.");
    const confirmed = await request(action.replaceAll("&amp;", "&"), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ session_code: sessionCode, confirmLogout: "Log out" }),
    });
    if (![200, 302, 303, 307].includes(confirmed.status)) throw new Error(`Keycloak did not finish logout: ${confirmed.status}`);
  }
}
console.log(`Sign-in and sign-out passed: ${username} (${expectedRole}); role access and local logout redirects accepted`);
