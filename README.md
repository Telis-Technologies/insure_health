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
| `docs/` | BRD, SRS, work plan, decisions, requirements, backlog, acceptance tests |
| `frontend/` | Owned by Ingrid/Lameck |

## Prerequisites

Docker with Docker Compose v2. Everything runs in containers; nothing is installed on the host.

## Setup

```sh
cp .env.example .env      # then replace the placeholder values; .env is git-ignored
docker compose up -d --build
docker compose ps         # db should show "(healthy)"
```

`.env` values:

| Variable | Meaning |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database created by the `db` container. Required. |
| `APP_ENV` | Free-form environment label (default `development`). |
| `API_PORT` | Host port the API is published on, bound to 127.0.0.1 (default `8000`). |

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

There is no seed step yet. The Case 001 seed is task T07.

## Known limitations

- Scaffolding only: no business tables, endpoints or rules exist. The baseline migration
  (`0001_baseline`) creates nothing.
- **Open: Postgres schema strategy** (per-module schemas vs one default schema) is for
  Tristan/Brian to decide. Everything uses the default `public` schema for now; see TODOs in
  `backend/app/shared/base.py` and `backend/alembic/env.py`.
- Not yet decided: auth/session (D04), hosting and deployment (D11), API contract and error
  envelope (T03), money column details beyond "integer minor units + currency" (D03).
- `GET /health` is a liveness check only; it does not query the database.
- The compose setup is for local development (`--reload`, bind-mounted source). It is not a
  deployment configuration.
- Test dependencies (`pytest`, `httpx`) are installed in the same image as runtime dependencies.
