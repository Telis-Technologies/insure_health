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

Open the public Claimwise landing page at `http://localhost:3000` (or `http://localhost:3001` if you intentionally run Next.js there). The app's sign-in button opens the Claimwise-branded identity form hosted by Keycloak on port 8080. The Keycloak Admin Console uses the local administrator credentials in the ignored root `.env`; it does not create a frontend account automatically. For the frontend, sign in as tenant admin `lameck` with his existing local password. The repair script also provisions separate role-specific accounts listed in [frontend/README.md](frontend/README.md); newly created accounts use the password in the ignored `.env.demo`. The imported `claimwise` realm defines role groups and the `claimwise-web` public OIDC client with authorization code + PKCE (S256). Local callback and post-logout redirects are restricted to ports 3000 and 3001.

The local repair script registers Keycloak user-profile attributes `tenant_ids`, `organization_ids`, and `organization_name` as administrator-managed, then assigns the appropriate role groups to local reference users. Available role names are `provider-biller`, `tpa-reviewer`, `insurer-claims-adjudicator`, `insurer-claims-approver`, `insurer-finance`, `insurer-policy-author`, `insurer-policy-approver`, `tenant-admin`, `platform-admin`, and `auditor`. Do not use direct-access password grants for application users. Production requires HTTPS, an explicit hostname, a production database, managed secrets, backups, and a reviewed tenant-isolation design; `start-dev` and shared local credentials are for development only.

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

- Scaffolding only: no business endpoints or rules exist. The baseline migration
  (`0001_baseline`) creates nothing. Proposed tables live in
  [`db/schema/001_initial.sql`](db/schema/001_initial.sql) and [`docs/erd.md`](docs/erd.md)
  for D03/D05 review. Alembic does not apply that file.
- **Open: Postgres schema strategy** (per-module schemas vs one default schema) is for
  Tristan/Brian to decide. Everything uses the default `public` schema for now; see TODOs in
  `backend/app/shared/base.py` and `backend/alembic/env.py`.
- Still open: exact tenant membership/organization grants and backend enforcement (D04), hosting and deployment (D11), API contract and error
  envelope (T03), money column details beyond "integer minor units + currency" (D03).
- `GET /health` is a liveness check only; it does not query the database.
- The compose setup is for local development (`--reload`, bind-mounted source). It is not a
  deployment configuration.
- Test dependencies (`pytest`, `httpx`) are installed in the same image as runtime dependencies.
