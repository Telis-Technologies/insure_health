import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: process.env.AUTH_KEYCLOAK_ISSUER && process.env.AUTH_KEYCLOAK_ID
    ? [Keycloak({ issuer: process.env.AUTH_KEYCLOAK_ISSUER, clientId: process.env.AUTH_KEYCLOAK_ID, clientSecret: process.env.AUTH_KEYCLOAK_SECRET, client: { token_endpoint_auth_method: "none" }, checks: ["pkce", "state"] })]
    : [],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, profile, account }) {
      if (profile) {
        const claims = profile as Record<string, unknown>;
        const realmAccess = claims.realm_access as { roles?: unknown } | undefined;
        token.roles = list(realmAccess?.roles);
        token.tenantIds = list(claims.tenant_ids);
        token.organizationIds = list(claims.organization_ids);
        token.organizationName = typeof claims.organization_name === "string" ? claims.organization_name : undefined;
      }
      if (account?.access_token) token.keycloakAccessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = list(token.roles);
        session.user.tenantIds = list(token.tenantIds);
        session.user.organizationIds = list(token.organizationIds);
        session.user.organizationName = typeof token.organizationName === "string" ? token.organizationName : undefined;
      }
      // Kept server-side; do not expose provider tokens in the browser session.
      return session;
    },
  },
});
