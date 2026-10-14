# Claimwise Health · investor MVP

This branch is a login-free, two-persona walkthrough for health claims. It uses **Next.js for the interface and APIs**, with a dedicated PostgreSQL container for claims, immutable versions, findings, events, document metadata and policy drafts. Keycloak and FastAPI are not started by this branch.

All records and policy parameters are fictional, illustrative examples. Persona tabs simulate a provider biller and claims reviewer; they are not authentication or an authorization boundary. Do not enter real patient data or use this prototype for live claim decisions.

## Run locally

Use Node 22.22.3 (see `.nvmrc`) and Docker Compose v2:

```sh
cd /tmp/claimwise-lean-mvp
docker compose up -d db
cd frontend
npm ci
cp .env.mvp.example .env.local
npm run dev
```

Open `http://localhost:3000` (or use `npm run dev -- --port 3001` if another app already owns port 3000). The first API request creates the MVP schema and five sample claims if the database is empty. The database binds to loopback on port `55432`, uses a dedicated `claimwise-mvp` volume and does not start Keycloak or FastAPI. The example password is only for local fictional data; replace it before exposing anything beyond loopback.

Private PDFs are stored outside the web root at `/tmp/claimwise-private-uploads` by default. Set `PRIVATE_UPLOAD_DIR` to another private persistent directory if needed. Each upload must be a PDF no larger than 20 MB. Documents are retrievable only through the app's local document route; this prototype has no user authentication, so keep the app on localhost.

For digital PDFs the app first tries local `pdftotext`. If no selectable text is available, it renders page one with `pdftoppm` and uses local `tesseract` when installed. If that OCR tool is missing or text is not readable, extraction is marked for manual review and the original PDF is retained. OCR output is never treated as verified; fields must be checked against the signed form. The instant reference scan uses preloaded sample fields so the pitch does not wait for OCR.

## Walkthrough

1. Start in **Provider billing** and open the existing Riverside claim with a correction request.
2. Attach a clinical report PDF (or use the instant reference scan for the fast path), confirm the evidence and resubmit.
3. Switch to **Claims reviewer** to inspect the new claim version, rule findings, source clauses, evidence and activity.
4. Request a correction, reject, or approve when no blocking findings remain. Switch back to Provider to view the same updated state.
5. Open **Policy & rules** to inspect the sample version history and save a draft. Publishing is intentionally disabled.

## Verification

```sh
npm run lint
npm run build
```

This MVP does not include insurer/provider onboarding, production auth, real insurer forms, verified electronic signatures, production policy publication, payment settlement or fraud/clinical decisions. Sample policy limits are illustrative and not approved insurance terms.
