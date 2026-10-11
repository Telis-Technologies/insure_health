# Claimwise Health frontend

## Local run

Use Node 22.22.3 (`nvm use`), then `npm ci && npm run dev`. The frontend expects Keycloak at `http://localhost:8080/realms/claimwise`; start it from the repo root with `docker compose up -d keycloak`. Copy `.env.example` to `.env.local`, generate `AUTH_SECRET` using `openssl rand -base64 32`, and restart Next.js after changing auth settings.

Auth.js (`next-auth@5` beta) performs the Keycloak OpenID Connect authorization-code flow with PKCE. Keycloak owns login, account recovery and role assignment. The frontend derives navigation and route visibility from Keycloak realm roles; this is only UI access shaping. Any future data/API endpoint must verify the Keycloak access token, authorize the capability, and enforce the tenant and organization membership on the server. Never treat client-side hidden navigation or `tenant_ids` as sufficient security.

The local realm configuration is in `../infra/keycloak/claimwise-realm.json`. For an existing local Keycloak volume, run `node --env-file=.env --env-file=.env.demo scripts/repair-keycloak-dev.mjs` from the repo root. The script repairs the OIDC scopes, registers admin-managed tenant attributes, and creates synthetic users. It is loopback/development-only. The ignored root `.env.demo` contains their local password; it is not the Keycloak Admin Console password (that is in the ignored root `.env`). Do not reuse either password outside this local demo.

Use `lameck` for the tenant administrator view, or switch roles with `provider.demo`, `reviewer.demo`, `adjudicator.demo`, `approver.demo`, `finance.demo`, `policy.author.demo`, `policy.approver.demo`, `auditor.demo`, and `platform.demo`. All are synthetic development identities. The frontend exposes separate provider, TPA/insurer review, finance, insurer policy governance, tenant-admin and platform-admin workspaces. For a fresh clone, set a unique 16+ character `CLAIMWISE_DEMO_PASSWORD` in your private environment (or ignored `.env.demo`) before running the script.

Verify the sign-in chain from the repo root with `node --env-file=.env.demo scripts/smoke-keycloak-login.mjs`. Set `CLAIMWISE_DEMO_USERNAME` and `CLAIMWISE_EXPECTED_ROLE` to test a different persona. The smoke test checks the authorization redirect, Keycloak login, Auth.js session, tenant claim, and role-based route denial.

`/admin/tenants` is the platform onboarding interface; `/organization` is insurer-tenant administration. They validate and explain the expected workflow but do not create persistent tenants or invite users yet because the access-management API and database services are still placeholders.

## Synthetic dataset

The frontend includes 50 synthetic insured-member records and 20 synthetic provider facilities for one demo tenant, plus policies and authorization examples. Claim intake uses searchable local choices and validates member-policy and member-authorization relationships. These are deterministic UI fixtures, not live customer/patient data, and claims are not persisted.

## Commands

```sh
npm run lint
npm run build -- --webpack
npm run dev
```
