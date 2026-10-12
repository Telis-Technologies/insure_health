# Claimwise Health frontend

## Local run

Use Node 22.22.3 (`nvm use`), then `npm ci && npm run dev`. The frontend expects Keycloak at `http://localhost:8080/realms/claimwise`; start it from the repo root with `docker compose up -d keycloak`. Copy `.env.example` to `.env.local`, generate `AUTH_SECRET` using `openssl rand -base64 32`, and restart Next.js after changing auth settings.

Auth.js (`next-auth@5` beta) performs the Keycloak OpenID Connect authorization-code flow with PKCE. Keycloak owns login, account recovery and role assignment. The frontend derives navigation and route visibility from Keycloak realm roles; this is only UI access shaping. Any future data/API endpoint must verify the Keycloak access token, authorize the capability, and enforce the tenant and organization membership on the server. Never treat client-side hidden navigation or `tenant_ids` as sufficient security.

The local realm configuration is in `../infra/keycloak/claimwise-realm.json`. For an existing local Keycloak volume, run `node --env-file=.env --env-file=.env.demo scripts/repair-keycloak-dev.mjs` from the repo root. The script repairs the OIDC scopes, registers admin-managed tenant attributes, and creates role-specific local users. It is loopback/development-only. The ignored root `.env.demo` contains the password for newly created users; it is not the Keycloak Admin Console password (that is in the ignored root `.env`). The script does not reset existing user passwords. Do not reuse either password outside this local environment.

Use these local Keycloak accounts to inspect separate workspaces:

| Username | Workspace |
| --- | --- |
| `Admin` | System Administrator (full access to all workspaces & views) |
| `lameck` | Harbor Health Assurance organization administration |
| `grace.wanjiku` | Riverside Medical Centre provider billing |
| `joseph.otieno` | MediBridge TPA review |
| `mercy.kamau` | Insurer claims adjudication |
| `peter.mutua` | Insurer claims approval |
| `faith.njeri` | Insurer finance |
| `sarah.wambui` | Insurer policy authoring |
| `david.ochieng` | Insurer policy approval |
| `naomi.chebet` | Audit |
| `felix.mwangi` | Platform administration |

New accounts use `CLAIMWISE_DEMO_PASSWORD` from the ignored root `.env.demo`; Lameck keeps his existing password. Older `*.demo` accounts remain in Keycloak for compatibility but are not the primary walkthrough accounts. The organization administrator does not inherit provider, reviewer, finance or rule-publication rights. For a fresh clone, set a unique 16+ character local password before running the script.

Verify the sign-in chain from the repo root with `node --env-file=.env.demo scripts/smoke-keycloak-login.mjs`. Set `CLAIMWISE_DEMO_USERNAME` and `CLAIMWISE_EXPECTED_ROLE` to test a different persona. The smoke test checks the authorization redirect, Keycloak login, Auth.js session, tenant claim, and role-based route denial.

`/admin/tenants` is the platform onboarding interface; `/organization` is insurer-tenant administration. They validate and explain the expected workflow but do not create persistent tenants or invite users yet because the access-management API and database services are still placeholders.

## Local reference records

The frontend includes 50 fictional Kenyan member names, 20 fictional Kenyan health facilities, plan and authorization choices, and six claim paths: paid/reconciled, approved/awaiting payment, authorization pending, clarification requested, appeal open, and partially reconciled. These are local reference records, not real patient or insurer data. Intake checks required fields and selectable relationships in the browser, but neither claims nor documents are saved or uploaded. API-side tenant/organization authorization, adjudication, payment and audit persistence remain to be built.

## Commands

```sh
npm run lint
npm run build -- --webpack
npm run dev
```
