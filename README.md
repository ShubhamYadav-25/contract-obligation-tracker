# Contract & Obligation Tracker

Local TypeScript monorepo for uploading contract PDFs, extracting page and line aware obligations, reviewing evidence against the source PDF, and tracking obligation state.

## Core Features

- React contract workspace with dashboard, contract list, obligation review, editable obligations, evidence navigation, activity, messages, and global obligation tracking.
- PDF-backed evidence review with source-anchor navigation, full PDF loading from the API, search, zoom, fit-width, fullscreen, and anchored citation callouts.
- Express API for contract ingestion, processing status, document text pages, source-aware obligation extraction, obligation updates, reminders, messages, audit, and KPI endpoints.
- Background processing for contract parsing, OCR fallback, text segmentation, obligation extraction, reminder delivery, and recovery jobs.
- PostgreSQL persistence with Supabase Storage for immutable PDF originals.

## Repository Structure

```text
.
|-- apps
|   |-- api
|   |   |-- src
|   |   |   |-- bootstrap          # route, worker, scheduler, shutdown wiring
|   |   |   |-- config             # env, database, storage, logging, job config
|   |   |   |-- infrastructure     # database, storage, PDF, OCR, email, LLM adapters
|   |   |   |-- jobs               # pollers, processors, producers, recovery
|   |   |   |-- modules            # domain modules: contracts, obligations, extraction, reminders
|   |   |   |-- scripts            # local operational commands and diagnostics
|   |   |   `-- shared             # errors, middleware, validation, shared API types
|   |   `-- tests                 # unit and integration tests
|   `-- web
|       |-- src
|       |   |-- app                # router, providers, query client, route paths
|       |   |-- components
|       |   |   |-- features       # reusable feature widgets such as the PDF reader
|       |   |   |-- feedback       # empty, error, loading, retry states
|       |   |   |-- layout         # shell and page layout primitives
|       |   |   `-- ui             # atomic UI controls
|       |   |-- features           # domain features and page modules
|       |   |-- services           # API client, query keys, API errors
|       |   |-- styles             # global CSS and PDF reader styling
|       |   |-- test               # test setup
|       |   |-- types              # third-party type shims
|       |   `-- utils              # shared frontend helpers
|       `-- visual-verification    # tracked UI verification screenshots
|-- packages
|   |-- database                  # migrations and seed documentation
|   |-- shared                    # shared enums, schemas, and state machines
|   `-- test-kit                  # fixtures and test utilities
|-- datasets                      # small tracked fixtures and README placeholders
|-- docs                          # implementation and stabilization reports
|-- reports                       # checked-in markdown reports only
`-- working-subset                # tracked CUAD subset manifest and local PDF subset
```

## Prerequisites

- Node.js 22 or newer.
- Corepack with pnpm 10.14.0.
- PostgreSQL connection in `DATABASE_URL`.
- Supabase project URL, service role key, and storage bucket.
- Gemini/Groq provider variables as documented in `.env.example`.

## Install

```powershell
corepack enable
corepack prepare pnpm@10.14.0 --activate
corepack pnpm install --frozen-lockfile
```

## Configure

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace placeholders. `.env` is ignored by git; verify with:

```powershell
git check-ignore -v .env
```

Important local variables:

- `DATABASE_URL`, `DATABASE_SSL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- `INGESTION_DEFAULT_ORGANIZATION_ID`, `INGESTION_DEFAULT_USER_ID`
- `OBLIGATION_EXTRACTOR_MODE`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `GROQ_API_KEY`, `GROQ_MODEL` when Groq extraction is enabled
- `OCR_PROVIDER`, `TESSERACT_WORKER_COUNT`
- `JOB_POLL_INTERVAL_MS`, `JOB_BATCH_SIZE`
- `EMAIL_PROVIDER=console` for local startup
- `VITE_API_BASE_URL`, `VITE_DEV_USER_ID`, `VITE_DEV_ORGANIZATION_ID`

Do not expose service-role or provider keys to Vite.

## Database

```powershell
corepack pnpm --filter @contract-obligation-tracker/api run migrate:workflow
```

## Run Locally

```powershell
corepack pnpm dev
```

The root `dev` command starts the API, embedded worker/scheduler runtime, and Vite web app.

Separate commands are available:

```powershell
corepack pnpm dev:api
corepack pnpm dev:worker
corepack pnpm dev:web
```

Default local URLs:

- Frontend: `http://localhost:5173/`
- API: `http://localhost:3000/`
- Health: `http://localhost:3000/health`

## Validate

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Focused package commands:

```powershell
corepack pnpm --filter @contract-obligation-tracker/api run typecheck
corepack pnpm --filter @contract-obligation-tracker/api run test:unit
corepack pnpm --filter @contract-obligation-tracker/web run typecheck
corepack pnpm --filter @contract-obligation-tracker/web run test
corepack pnpm --filter @contract-obligation-tracker/web run build
```

## Useful Local Commands

```powershell
corepack pnpm --filter @contract-obligation-tracker/api run gemini:doctor
corepack pnpm reset:dev-data
corepack pnpm import:cuad-subset
```

## Artifact Hygiene

Generated build output, logs, coverage, local env files, package-manager stores, test reports, raw downloads, and generated dataset PDFs are ignored by git. Keep checked-in artifacts limited to source, tests, migrations, docs, small fixtures, and intentional verification evidence.
