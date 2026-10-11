import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      tenantIds: string[];
      organizationIds: string[];
      organizationName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: string[];
    tenantIds?: string[];
    organizationIds?: string[];
    organizationName?: string;
    keycloakAccessToken?: string;
  }
}
