# Claimwise (insure_health)

A claim verification platform designed to limit fraud between insurers and health facilities.
One-week demonstration build using **synthetic data only**. Stack: Next.js + TypeScript (frontend),
FastAPI + PostgreSQL (backend).

Project scope, requirements, decisions and tasks live in [docs/](docs/). Start with
[docs/AGENTS.md](docs/AGENTS.md) and [docs/README.md](docs/README.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI app (`app/`), Alembic migrations (`alembic/`), tests |
| `backend/app/modules/` | Domain modules: access, coverage, claims, settlement, reporting, history, audit. Each has `models.py`, `dtos.py`, `services.py`, `controllers.py` |
| `contracts/` | OpenAPI contract (produced by T03) |
| `fixtures/` | Approved synthetic fixtures, copied unchanged from the agent pack (nulls mean unknown) |
| `db/schema/` | Proposed PostgreSQL DDL (`001_initial.sql`), pending D03/D05. Alembic does not apply it |
| `docs/` | BRD, SRS, work plan, decisions, requirements, backlog, acceptance tests, ERD |
| `frontend/` | Owned by Ingrid/Lameck |

## Prerequisites

Docker with Docker Compose v2 for PostgreSQL, FastAPI and Keycloak. The Next.js frontend runs on Node.js 22.22.3 (see `frontend/.nvmrc`).

## Setup

```sh
cp .env.example .env      # then replace the placeholder values; .env is git-ignored
docker compose up -d --build db backend keycloak
docker compose ps         # db should show healthy; Keycloak imports the Claimwise realm

# Use Node 22, then put a private 16+ character CLAIMWISE_DEMO_PASSWORD in
# an ignored .env.demo file (generate one with `openssl rand -hex 20`).
nvm use 22.22.3
node --env-file=.env --env-file=.env.demo scripts/repair-keycloak-dev.mjs

cd frontend
nvm use
npm ci
cp .env.example .env.local   # generate AUTH_SECRET with `openssl rand -base64 32`
npm run dev
```

Open the frontend at `http://localhost:3000` and Keycloak administration at `http://localhost:8080`. The Admin Console uses the local administrator credentials in the ignored root `.env`; it does not create a frontend account automatically. For the frontend, sign in as synthetic tenant admin `lameck` with the password in the ignored `.env.demo`. The repair script also provisions separate demo personas listed in [frontend/README.md](frontend/README.md). The imported `claimwise` realm defines role groups and the `claimwise-web` public OIDC client with authorization code + PKCE (S256). The web client callback is `http://localhost:3000/api/auth/callback/keycloak`.

The local repair script registers Keycloak user-profile attributes `tenant_ids`, `organization_ids`, and `organization_name` as administrator-managed, then assigns the appropriate role groups to synthetic users. Available role names are `provider-biller`, `tpa-reviewer`, `insurer-claims-adjudicator`, `insurer-claims-approver`, `insurer-finance`, `insurer-policy-author`, `insurer-policy-approver`, `tenant-admin`, `platform-admin`, and `auditor`. Do not use direct-access password grants for application users. Production requires HTTPS, an explicit hostname, a production database, managed secrets, backups, and a reviewed tenant-isolation design; `start-dev` and shared demo credentials are for local development only.

`.env` values:

| Variable | Meaning |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database created by the `db` container. Required. |
| `APP_ENV` | Free-form environment label (default `development`). |
| `API_PORT` | Host port the API is published on, bound to 127.0.0.1 (default `8000`). |
| `KEYCLOAK_PORT`, `KEYCLOAK_ADMIN_USERNAME`, `KEYCLOAK_ADMIN_PASSWORD` | Local Keycloak developer console. Use strong local credentials; never reuse them in production. |

The backend's `DATABASE_URL` is assembled by `docker-compose.yml` from these values.
The database port is not published to the host; use `docker compose exec db psql ...`.

## Migrations

There is one migration history shared by all backend developers (`backend/alembic/versions/`).

```sh
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
docker compose exec backend alembic downgrade base
```

Creating a revision (coordinate with the other backend owner first; run as your host user so
the generated file isn't owned by root):

```sh
docker compose run --rm --user "$(id -u):$(id -g)" backend \
  alembic revision --autogenerate --rev-id 0002_<short_name> -m "<description>"
```

Every module's `models.py` is imported in `alembic/env.py`, so autogenerate sees all tables.
Review generated migrations by hand before committing. `alembic check` reports drift between
models and the database.

## Backend access (T06)

Keycloak is the identity provider (D04, 2026-10-12). The backend never issues tokens or stores
passwords. Callers send the Keycloak access token as `Authorization: Bearer <token>`. The
backend checks the RS256 signature against the realm keys, the expiry, the issuer
(`http://localhost:${KEYCLOAK_PORT}/realms/claimwise`) and the audience (`claimwise-api`).
`docker-compose.yml` sets these as `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URL` and `KEYCLOAK_AUDIENCE`.

- **Roles** come from the token's `realm_access.roles`: Lameck's 10 realm roles plus `patient`.
  The **permissions** each role grants are stored in Postgres (`0003_access_seed`) and read on
  every request.
- **Organizations:** a user's single `organization_ids` entry must be registered as a tenant
  (`external_id`) by the platform admin. Unregistered organizations get 403. A role only counts
  when its organization type matches (insurer, hospital or tpa).
- **TPA scope** comes from `tpa_delegations`, not from the token's `tenant_ids`.
- **Revocation:** permission changes and organization disables apply on the next request.
  Removing a role or disabling a user in Keycloak applies when the token expires (Keycloak
  default: 5 minutes).

The platform admin (`platform-admin`, no data permissions) manages organizations, TPA delegations,
role permissions and patient-member links through `/api/v1/admin/*`. Users and role assignments
are managed in Keycloak.

Other modules protect each endpoint with both checks from `app.modules.access`:

```python
principal = Depends(require_permission("claims:approve"))          # 401/403
await services.ensure_in_scope(session, principal, claim, "Claim")  # 404 if out of scope
select(Claim).where(services.scope_clause(principal, Claim.insurer_tenant_id,
                                          Claim.provider_tenant_id, Claim.member_id))
```

Check permission codes, never role names. `history:read` and `consent:manage` are granted to no
role while D07 is deferred; `services.ensure_history_access` refuses every request until T17.

## Run

The `backend` service runs `uvicorn app.main:app --reload` on `http://127.0.0.1:${API_PORT}`.

```sh
curl -i http://127.0.0.1:8000/health      # use your API_PORT
docker compose logs -f backend
```

## Test

```sh
docker compose exec backend pytest
```

Access tests use a real Postgres database, `<POSTGRES_DB>_test` on the same server. They
create it and migrate it to head on first run. Each test runs in a transaction that is rolled
back afterwards. Tokens are Keycloak-shaped and signed with a throwaway RSA key; the tests do
not need Keycloak running.

## Continuous integration

[`.github/workflows/backend.yml`](.github/workflows/backend.yml) runs on pushes to `main`, on pull
requests that touch `backend/`, and on demand. Against a PostgreSQL 16 service it runs
`alembic upgrade head`, `alembic check`, `alembic downgrade base` then `upgrade head` again, and
`pytest`. Keycloak isn't needed: the tests sign their own tokens. Deployment isn't configured yet
(D11, D12).

## Inspect the database

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Reset

Drops all data, including the database volume:

```sh
docker compose down -v
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

The Keycloak demo identities can be recreated with `scripts/repair-keycloak-dev.mjs`; it resets their local passwords to `CLAIMWISE_DEMO_PASSWORD`. There is no business-data seed step yet. The Case 001 seed is task T07.

## Known limitations

- Only access endpoints (auth and platform administration) exist; no claims, coverage,
  settlement, reporting or history endpoints yet. Proposed tables live in
  [`db/schema/001_initial.sql`](db/schema/001_initial.sql) and [`docs/erd.md`](docs/erd.md)
  for D03/D05 review. Alembic does not apply that file.
- **Open: Postgres schema strategy** (per-module schemas vs one default schema) is for
  Tristan/Brian to decide. Everything uses the default `public` schema for now; see TODOs in
  `backend/app/shared/base.py` and `backend/alembic/env.py`.
- Access limitations: `tpa-reviewer` has no `payments:read` or `reports:read` (open in D04),
  so the frontend `/reports` page gets 403 from the API for TPA users. Keycloak role removal
  applies at token expiry. `patient_member_links.member_id` has no FK until the coverage
  members table exists (T07). `audit_events` is a minimal table added by T06.
- The `patient` realm role is in `infra/keycloak/claimwise-realm.json`. `--import-realm` skips
  an existing realm, so an existing Keycloak volume needs the role added in the admin console,
  or `docker compose down -v` to re-import.
- Still open: exact tenant membership/organization grants (D04), hosting and deployment (D11), API contract and error
  envelope (T03), money column details beyond "integer minor units + currency" (D03).
- `GET /health` is a liveness check only; it does not query the database.
- The compose setup is for local development (`--reload`, bind-mounted source). It is not a
  deployment configuration.
- Test dependencies (`pytest`, `httpx`) are installed in the same image as runtime dependencies.
