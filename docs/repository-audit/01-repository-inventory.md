# Repository Inventory

Date: 2026-07-21

Scope: read-only inventory of the Contract & Obligation Tracker monorepo. Source files were not deleted, renamed, refactored, installed, or modified during inspection. This document is the only created artifact for this prompt.

## Inspection Summary

- Files inspected/enumerated: 365 non-excluded repository files.
- Directories intentionally excluded from the inspected file count: 8.
- Excluded directories: `.git`, `.pnpm-store`, `node_modules`, `downloads`, `raw`, `apps/api/dist`, `apps/web/dist`, `apps/web/visual-verification`.
- Excluded categories not currently present at the workspace root during inspection: `coverage`, `.vite`, generic `build` output.
- Secret-bearing local `.env` was not read; `.env.example` was inspected instead.

## Important Repository Tree

```text
.
|-- apps/
|   |-- api/
|   |   |-- src/
|   |   |   |-- app.ts
|   |   |   |-- server.ts
|   |   |   |-- bootstrap/
|   |   |   |-- config/
|   |   |   |-- infrastructure/
|   |   |   |-- jobs/
|   |   |   |-- modules/
|   |   |   |-- scripts/
|   |   |   `-- shared/
|   |   |-- tests/
|   |   |   |-- integration/
|   |   |   `-- unit/
|   |   |-- package.json
|   |   `-- tsconfig.json
|   `-- web/
|       |-- src/
|       |   |-- app/
|       |   |-- components/
|       |   |-- features/
|       |   |-- services/
|       |   |-- styles/
|       |   |-- test/
|       |   `-- main.tsx
|       |-- index.html
|       |-- package.json
|       |-- postcss.config.cjs
|       |-- tailwind.config.ts
|       |-- tsconfig.json
|       `-- vite.config.ts
|-- packages/
|   |-- database/
|   |   |-- migrations/
|   |   |-- scripts/
|   |   |-- seeds/
|   |   `-- package.json
|   |-- shared/
|   |   |-- src/
|   |   `-- package.json
|   `-- test-kit/
|       |-- src/
|       `-- package.json
|-- datasets/
|-- docs/
|-- reports/
|-- scripts/
|-- working-subset/
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
`-- tsconfig.base.json
```

## Applications and Packages

| Path                | Classification       | Role                                                                                                                              |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`          | active               | Express API, background worker bootstrap, scheduler entry, PostgreSQL repositories, contract ingestion, processing run lifecycle. |
| `apps/web`          | active               | React/Vite frontend shell and workflow prototype.                                                                                 |
| `packages/database` | active               | Versioned SQL migrations plus seed/script placeholders. No package-level migration runner script is implemented.                  |
| `packages/shared`   | partially integrated | Shared obligation state machine exported for app use; many README placeholder folders remain.                                     |
| `packages/test-kit` | test-only            | Test helpers, fixture loading, fixed clock, mock provider types, KPI report types.                                                |
| `datasets`          | development-only     | README placeholders for contracts, labels, reminders, and transitions.                                                            |
| `working-subset`    | development-only     | 25-contract CUAD working subset PDFs and manifest used by import/fixture validation.                                              |
| `reports`           | development-only     | KPI/reporting notes and backend connection check output.                                                                          |
| `docs`              | active               | Architecture/module/API documentation and this repository audit.                                                                  |
| `scripts`           | development-only     | Workspace placeholder script.                                                                                                     |

## Runtime Entry Points

| Entry                                        | Classification   | Runtime chain                                                                                                                                                            |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/server.ts`                     | active           | Loads env, creates logger, creates Express app, creates HTTP server, registers workers, registers schedulers, wires graceful shutdown, listens on `API_HOST`/`API_PORT`. |
| `apps/api/src/app.ts`                        | active           | Creates Express app, disables `x-powered-by`, configures CORS, JSON parser, request correlation, routes, not-found middleware, error middleware.                         |
| `apps/api/src/jobs/worker-entry.ts`          | active           | Standalone worker process entry; loads env/logger through `registerWorkers`, adds SIGINT/SIGTERM shutdown.                                                               |
| `apps/api/src/jobs/scheduler-entry.ts`       | active           | Standalone cron scheduler entry; constructs reminder poller and cron task, adds shutdown.                                                                                |
| `apps/api/src/scripts/check-connections.ts`  | development-only | Connection smoke script for env, PostgreSQL, and Supabase storage.                                                                                                       |
| `apps/api/src/scripts/import-cuad-subset.ts` | development-only | Imports the 25-contract working subset via contract ingestion service.                                                                                                   |
| `apps/web/src/main.tsx`                      | active           | React DOM root, renders `App`, imports global CSS.                                                                                                                       |
| `apps/web/src/app/app.tsx`                   | active           | Wraps router in app providers.                                                                                                                                           |

## Backend Runtime Chains

### Server to Middleware to Routes

```text
apps/api/src/server.ts
  -> loadEnv()
  -> createLogger(env)
  -> createApp()
     -> cors({ origin: getCorsOrigin() })
     -> express.json({ limit: "1mb" })
     -> requestCorrelationMiddleware
     -> registerRoutes(app)
        -> /health -> createHealthRouter()
        -> /api/v1/contracts -> createContractRouter()
        -> /api/obligations -> createObligationRouter()
        -> /api/reminders -> createReminderRouter()
        -> /api/kpi -> createKpiRouter()
     -> notFoundMiddleware
     -> errorMiddleware
  -> createServer(app)
  -> registerWorkers({ logger })
  -> registerSchedulers({ logger })
  -> createGracefulShutdown(...)
```

### Controller to Service to Repository to Database

```text
POST /api/v1/contracts
  -> ContractController.ingest()
  -> createContractIngestionService()
  -> ContractIngestionService.ingest()
  -> validateContractPdfFile()
  -> FileHashService.sha256()
  -> PostgresContractDocumentRepository.findByOrganizationAndHash()
  -> SupabaseStorageProvider.upload()
  -> PgTransactionManager.inTransaction()
     -> PostgresContractRepository.create()
     -> PostgresContractDocumentRepository.create()
     -> PostgresContractRepository.assignCurrentDocument()
     -> PostgresContractProcessingRepository.createRun()
     -> PostgresAuditRepository.append()
  -> ContractProcessingProducer.enqueue()
  -> PostgresJobRepository.createJob()
  -> PostgresContractProcessingRepository.markQueued()
```

```text
GET /api/v1/contracts/:contractId/processing-status
  -> ContractController.processingStatus()
  -> createContractIngestionService()
  -> ContractIngestionService.findProcessingStatus()
  -> PostgresContractProcessingRepository.findLatestByContractId()
```

The obligations, reminders, and KPI controllers are registered, but their exposed list endpoints currently return 501 `NOT_IMPLEMENTED` responses.

## Backend Registration Map

| Mount path              | Route file                                  | Controller/service                               | Classification       | Notes                                                        |
| ----------------------- | ------------------------------------------- | ------------------------------------------------ | -------------------- | ------------------------------------------------------------ |
| `/health`               | `modules/health/health.routes.ts`           | inline health handler                            | active               | Returns service health JSON.                                 |
| `/api/v1/contracts`     | `modules/contracts/contracts.routes.ts`     | `ContractController`, `ContractIngestionService` | active               | Upload and processing status endpoints are wired.            |
| `/api/obligations`      | `modules/obligations/obligations.routes.ts` | `ObligationController`                           | partially integrated | Route exists; `GET /` returns 501.                           |
| `/api/reminders`        | `modules/reminders/reminders.routes.ts`     | `ReminderController`                             | partially integrated | Route exists; `GET /` returns 501.                           |
| `/api/kpi`              | `modules/kpi/kpi.routes.ts`                 | `KpiController`                                  | partially integrated | Route exists; `GET /runs` returns 501.                       |
| review module           | no route registration found                 | `ReviewService`, repository/types                | partially integrated | Domain files exist but are not mounted.                      |
| extraction module       | no route registration found                 | `ExtractionService`, schemas/types               | partially integrated | Service abstractions exist but no route/runtime chain found. |
| source-anchoring module | no route registration found                 | validator/types                                  | partially integrated | Domain support exists but no route/runtime chain found.      |
| notifications module    | no route registration found                 | provider/types                                   | partially integrated | Provider exists for internal use; no route runtime.          |

## Worker and Scheduler Map

### Job Runner to Processor Registry to Workers

```text
registerWorkers()
  -> createWorkerRuntime()
     -> loadEnv()
     -> createJobConfig(env)
     -> PgPoolClient(createDatabaseConfig(env))
     -> PgTransactionManager(database.pool)
     -> PostgresJobRepository
     -> ContractProcessingOrchestrator
        -> PostgresContractProcessingRepository
        -> PostgresAuditRepository
        -> PipelineNotConfigured
     -> ContractProcessingProcessor
     -> ReminderDeliveryProcessor
     -> ProcessorRegistry(
          PROCESS_CONTRACT -> ContractProcessingProcessor.process()
          DELIVER_REMINDER -> ReminderDeliveryProcessor.process()
        )
     -> JobRunner
     -> JobPoller
     -> PollingLoop.start()
```

| Worker/processor             | Registration                             | Classification       | Notes                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROCESS_CONTRACT`           | `register-workers.ts` processor registry | active               | Claims queued contract processing runs and calls `ContractProcessingOrchestrator`. Pipeline implementation is `PipelineNotConfigured`, so real extraction is not implemented yet. |
| `DELIVER_REMINDER`           | `register-workers.ts` processor registry | partially integrated | Processor is registered in the map, but `ReminderDeliveryProcessor` throws not implemented; returned worker `names` only lists `PROCESS_CONTRACT`.                                |
| `ContractProcessingProducer` | contract ingestion dependency graph      | active               | Enqueues `PROCESS_CONTRACT` background jobs with deterministic idempotency keys.                                                                                                  |
| `ReminderProducer`           | producer file present                    | partially integrated | Creates `DELIVER_REMINDER` jobs, but no active service/controller chain found.                                                                                                    |

### Scheduler Bootstrap to Registered Schedulers

| Entry/bootstrap                                 | Classification       | Notes                                                                                                        |
| ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `bootstrap/register-schedulers.ts`              | partially integrated | Called by `server.ts`, logs empty scheduler list and returns a closeable registry with `names: []`.          |
| `jobs/scheduler-entry.ts`                       | active               | Standalone scheduler process wires `node-cron`, `ReminderPoller`, and `PostgresReminderSchedulerRepository`. |
| `jobs/schedulers/reminder-poller.ts`            | active               | Polls due reminders and enqueues reminder delivery jobs through repository SQL.                              |
| `jobs/schedulers/obligation-state.scheduler.ts` | partially integrated | File exists but throws "not implemented yet".                                                                |

## Frontend Runtime and Route Map

### Frontend Entry to Router to Layouts to Pages

```text
apps/web/src/main.tsx
  -> <App />
     -> <AppProviders />
        -> QueryClientProvider
        -> AuthProvider
        -> ErrorBoundary
        -> RouterProvider(router)
           -> AppShell
              -> Sidebar nav
              -> Outlet
                 -> workflow pages
```

| Path                         | Element                                            | Classification       | Notes                                                                     |
| ---------------------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `/`                          | `Navigate` to `/dashboard`                         | active               | Home redirect.                                                            |
| `/dashboard`                 | `DashboardPage` from `features/workflow/pages.tsx` | active               | Uses browser-session uploads and real upload/status APIs.                 |
| `/contracts`                 | `ContractsPage` from workflow pages                | active               | Upload and local upload list. Server-side list endpoint is not available. |
| `/contracts/:contractId`     | `ContractWorkspacePage` from workflow pages        | active               | Polls processing status endpoint; other tabs show unavailable states.     |
| `/obligations`               | `ObligationsPage` from workflow pages              | partially integrated | Calls obligation list API, which currently returns 501.                   |
| `/obligations/:obligationId` | `ObligationsPage`                                  | partially integrated | Reuses list page; detail endpoint is not wired in router.                 |
| `/contracts/upload`          | `Navigate` to `/contracts`                         | active               | Upload is modal-driven from contracts/dashboard.                          |
| `/reviews`                   | `Navigate` to `/dashboard`                         | partially integrated | Older review pages exist but are not reachable in current router.         |
| `/reviews/:candidateId`      | `Navigate` to `/dashboard`                         | partially integrated | Detail page not reachable.                                                |
| `/kpis`                      | `Navigate` to `/dashboard`                         | partially integrated | Older KPI dashboard page exists but is not reachable in current router.   |
| `/login`                     | route constant only                                | partially integrated | `routePaths.login` exists, but no current router entry.                   |

## Provider Configuration and Selected Adapters

| Provider area     | Env/config                                                          | Selected adapter in active runtime             | Classification       | Notes                                                                                                                          |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Database          | `DATABASE_URL`, pool/timeout SSL vars                               | `PgPoolClient`, `PgTransactionManager`         | active               | Used by API service dependencies, workers, scheduler entry, repositories.                                                      |
| Storage           | `STORAGE_PROVIDER`, Supabase vars                                   | `SupabaseStorageProvider`                      | partially integrated | Env allows `local`, but active contract ingestion always constructs Supabase provider. No local provider implementation found. |
| Jobs              | `JOB_*`, `WORKER_ID`                                                | PostgreSQL `PostgresJobRepository`             | active               | Used by producers, worker runtime, scheduler entry.                                                                            |
| Scheduler         | `SCHEDULER_CRON`, timezone/lookahead vars                           | `node-cron` in standalone `scheduler-entry.ts` | partially integrated | Server bootstrap scheduler registry is empty.                                                                                  |
| OCR               | `OCR_PROVIDER`, `TESSERACT_WORKER_COUNT`                            | none selected in active runtime                | partially integrated | Tesseract and Gemini Vision adapters exist but throw not wired.                                                                |
| LLM               | `GEMINI_API_KEY`, `GEMINI_MODEL`                                    | none selected in active runtime                | partially integrated | Gemini adapter exists but throws not wired.                                                                                    |
| Email             | `EMAIL_PROVIDER`, SMTP/mail vars                                    | none selected in active runtime                | partially integrated | Console notification provider exists; Mailtrap/Resend adapters throw not wired.                                                |
| Frontend API/auth | `VITE_API_BASE_URL`, `VITE_DEV_USER_ID`, `VITE_DEV_ORGANIZATION_ID` | fetch client with development auth headers     | development-only     | Used by local auth provider and API client headers.                                                                            |

## Database Migration Map

| Migration                                                         | Classification       | Purpose                                                                                                                                       |
| ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `202607200001_supabase_postgres_jobs.up.sql` / `.down.sql`        | active               | Creates PostgreSQL job status types, reminder status types, `background_jobs`, `reminders`, `reminder_delivery_attempts`, and `audit_events`. |
| `202607210001_contract_ingestion.up.sql` / `.down.sql`            | active               | Creates `contracts`, `contract_documents`, `contract_processing_runs`, ingestion indexes, and audit event table/index guards.                 |
| `202607210002_contract_processing_lifecycle.up.sql` / `.down.sql` | active               | Extends processing runs with lifecycle timestamps/error fields, broadens status constraint, and adds claimable processing index.              |
| `packages/database/scripts/README.md`                             | partially integrated | Placeholder for database maintenance and migration helper scripts. No actual runner found.                                                    |

No package script currently runs migrations directly. Migrations appear intended for manual/application-specific execution outside this repository's scripts.

## Package Scripts

| Package             | Script                                                                    | Classification       | Command                                                                                    |
| ------------------- | ------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| root                | `install:workspaces`                                                      | development-only     | `corepack pnpm install`                                                                    |
| root                | `dev`                                                                     | development-only     | Run all app dev scripts in parallel.                                                       |
| root                | `dev:web`                                                                 | development-only     | Run web dev server.                                                                        |
| root                | `dev:api`                                                                 | development-only     | Run API dev server.                                                                        |
| root                | `build`                                                                   | active               | Build app workspaces.                                                                      |
| root                | `typecheck`                                                               | active               | Typecheck workspaces.                                                                      |
| root                | `test`                                                                    | active               | Run workspace tests.                                                                       |
| root                | `test:kpi`                                                                | test-only            | Run test-kit KPI script; no matching script was found in `packages/test-kit/package.json`. |
| root                | `import:cuad-subset`                                                      | development-only     | Run API CUAD import script.                                                                |
| root                | `lint`                                                                    | partially integrated | Calls workspace lint scripts, but no package lint scripts or ESLint config were found.     |
| root                | `format` / `format:check`                                                 | development-only     | Prettier write/check.                                                                      |
| `apps/api`          | `dev`, `start`, `worker`, `scheduler`                                     | active               | API server, built server, worker entry, scheduler entry.                                   |
| `apps/api`          | `check:connections`, `import:cuad-subset`                                 | development-only     | Operational/local scripts.                                                                 |
| `apps/api`          | `build`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:kpi` | active/test-only     | TypeScript and Vitest commands. No `tests/kpi` directory found.                            |
| `apps/web`          | `dev`, `preview`                                                          | development-only     | Vite dev/preview.                                                                          |
| `apps/web`          | `build`, `typecheck`, `test`                                              | active/test-only     | TypeScript, Vite build, Vitest.                                                            |
| `packages/database` | none                                                                      | partially integrated | Package has no scripts.                                                                    |
| `packages/shared`   | no scripts inspected in output                                            | unknown              | Package exists and is referenced by web.                                                   |
| `packages/test-kit` | no test script observed during inventory                                  | test-only            | Root `test:kpi` expects one, but package script mapping was not found.                     |

## Configuration Map

| Config                                | Classification       | Notes                                                                                                     |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml`                 | active               | Includes `apps/*` and `packages/*`.                                                                       |
| `tsconfig.base.json`                  | active               | Strict TypeScript base config with path aliases for shared and test-kit.                                  |
| `apps/api/tsconfig.json`              | active               | NodeNext API build, includes `src` and `tests`, outputs to `dist`.                                        |
| `apps/web/tsconfig.json`              | active               | Bundler/React JSX config, includes Vite/Tailwind/PostCSS config files.                                    |
| `packages/shared/tsconfig.json`       | active               | Shared source build to `dist`.                                                                            |
| `packages/test-kit/tsconfig.json`     | test-only            | Test helper source build to `dist`.                                                                       |
| `apps/web/vite.config.ts`             | active               | React plugin, aliases, Vitest jsdom setup.                                                                |
| `apps/web/tailwind.config.ts`         | active               | Tailwind content paths and custom theme tokens.                                                           |
| `apps/web/postcss.config.cjs`         | active               | Tailwind and autoprefixer plugins.                                                                        |
| `.prettierrc.json`, `.prettierignore` | development-only     | Formatting configuration.                                                                                 |
| ESLint config                         | partially integrated | Root has `lint` script, but no ESLint config or package lint scripts were found.                          |
| CI/CD/deployment config               | unknown              | No `.github`, Docker, Vercel, Netlify, Render, or `.openai/hosting.json` config found in inspected files. |

## Environment Variable Schema

Backend schema is centralized in `apps/api/src/config/env.ts`, with typed consumers in `database.ts`, `storage.ts`, `jobs.ts`, `scheduler.ts`, and `logger.ts`.

| Area               | Variables                                                                                                        | Classification              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Application/API    | `NODE_ENV`, `APP_NAME`, `APP_BASE_URL`, `API_HOST`, `API_PORT`, `CORS_ORIGIN`                                    | active                      |
| Contract ingestion | `CONTRACT_MAX_FILE_SIZE_MB`, `CONTRACT_MAX_PAGE_COUNT`, `CUAD_IMPORT_CONCURRENCY`, default organization/user IDs | active/development-only     |
| Database           | `DATABASE_URL`, `DATABASE_SSL`, pool and timeout vars                                                            | active                      |
| Storage            | `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`                       | partially integrated        |
| Gemini/OCR         | `GEMINI_API_KEY`, `GEMINI_MODEL`, `OCR_PROVIDER`, `TESSERACT_WORKER_COUNT`                                       | partially integrated        |
| Email/JWT          | `EMAIL_PROVIDER`, `EMAIL_FROM`, SMTP vars, JWT vars                                                              | partially integrated        |
| Jobs/scheduler     | `JOB_*`, `WORKER_ID`, `REMINDER_CRON_TIMEZONE`, `SCHEDULER_CRON`, `REMINDER_LOOKAHEAD_MINUTES`                   | active/partially integrated |
| Logging            | `LOG_LEVEL`, `LOG_FORMAT`                                                                                        | active                      |
| Frontend           | `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_DEV_ORGANIZATION_ID`, `VITE_DEV_USER_ID`                              | development-only            |

## Test and Fixture Map

| Path                                    | Classification   | Coverage area                                                                                                                                                                                                 |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/tests/unit`                   | test-only        | Health, env parsing, error responses, retry policy, job keys, worker registration, file validation, ingestion service, processing processor/orchestrator, state machines, CUAD manifest, storage object keys. |
| `apps/api/tests/integration`            | test-only        | PostgreSQL job repository and contract processing repository behavior. Integration tests depend on a test database URL.                                                                                       |
| `apps/web/src/**/*.test.ts(x)`          | test-only        | API client error handling, query keys, upload schema, error boundary, review form, KPI scoreboard, obligation transition dialog.                                                                              |
| `packages/test-kit/src`                 | test-only        | Fixed clock, fixture loading, mock providers, database test helper contracts, KPI report types.                                                                                                               |
| `working-subset/manifest.json` and PDFs | development-only | CUAD import subset and manifest validation.                                                                                                                                                                   |
| `datasets/*/README.md`                  | development-only | Dataset placeholders for planned contracts, labels, reminders, transitions.                                                                                                                                   |

## Generated, Temporary, and Build Output

| Path/pattern                                                                           | Classification   | Notes                                                              |
| -------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `apps/api/dist`, `apps/web/dist`                                                       | generated        | Build output directories present and excluded.                     |
| `apps/web/visual-verification`                                                         | generated        | Screenshot artifacts from UI verification, excluded.               |
| `.api*.pid`, `.web*.pid`                                                               | development-only | Local process ID artifacts.                                        |
| `.api*.log`, `.web*.log`, `.contract-status-body.*.log`, `.dev-connection-smoke.*.log` | development-only | Local runtime/check output artifacts.                              |
| `node_modules`, `.pnpm-store`                                                          | generated        | Dependency install/cache directories, excluded.                    |
| `downloads`, `raw`                                                                     | development-only | Local dataset/download material, excluded from detailed inventory. |

## Areas That Appear Incomplete or Disconnected

| Area                                        | Classification       | Evidence                                                                                                                                                                              |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract processing pipeline                | partially integrated | Worker/orchestrator/repository lifecycle are wired, but runtime uses `PipelineNotConfigured`, so document extraction/review creation is not implemented.                              |
| Contract list/detail/retry/PDF-viewing APIs | partially integrated | Frontend API files and UI affordances exist, but registered backend routes expose only upload and processing status.                                                                  |
| Obligations API                             | partially integrated | Route is mounted at `/api/obligations`; controller returns 501. Repository/service/domain files exist.                                                                                |
| Reminders API and delivery                  | partially integrated | Route returns 501; reminder scheduler repository and producer exist; delivery processor throws not implemented.                                                                       |
| KPI API                                     | partially integrated | Route is mounted at `/api/kpi/runs`; controller returns 501. KPI frontend components and tests exist.                                                                                 |
| Review routes                               | partially integrated | Review domain and frontend feature files exist, but backend review routes are not registered and router redirects review paths to dashboard.                                          |
| Source/PDF evidence viewing                 | partially integrated | Source anchoring and PDF viewer UI exist; no signed document/read endpoint is registered.                                                                                             |
| Scheduler registration in API server        | partially integrated | `server.ts` calls `registerSchedulers`, but that bootstrap returns an empty registry. Standalone `scheduler-entry.ts` has the reminder cron wiring.                                   |
| Storage provider selection                  | partially integrated | Env schema permits `local`; active contract ingestion always constructs `SupabaseStorageProvider`.                                                                                    |
| OCR/LLM/email adapters                      | partially integrated | Interfaces/adapters exist, but adapters throw not wired or have no active provider selection in runtime.                                                                              |
| Migration runner                            | partially integrated | SQL migrations exist; package scripts do not expose a migration apply/rollback command.                                                                                               |
| ESLint                                      | partially integrated | Root `lint` script exists, but no ESLint config or package lint scripts were found.                                                                                                   |
| CI/CD/deployment                            | unknown              | No CI/CD or deployment config found in inspected files.                                                                                                                               |
| Older frontend feature pages                | partially integrated | Many feature-specific pages/components/hooks remain in the source tree, while current router points primarily to `features/workflow/pages.tsx` and redirects review/KPI upload paths. |
