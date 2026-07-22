# Backend Wiring and Service Map

This document describes how backend components in `apps/api` are wired today, which technologies they use, and which services are currently implemented versus prepared as integration boundaries.

The backend is intentionally a modular monolith. HTTP, workers, schedulers, persistence, storage, extraction, review, reminders, audit, and reporting live in one deployable API codebase, with separate runtime entrypoints for web requests, background jobs, and scheduled reminder enqueueing.

## Backend Tech Stack

| Area                 | Technology                                   | Current role                                                          |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Runtime              | Node.js, TypeScript, ESM                     | API, worker, and scheduler execution                                  |
| HTTP server          | Express                                      | REST API routing and middleware                                       |
| Validation           | Zod                                          | Environment parsing and request/domain schemas                        |
| Database             | PostgreSQL via `pg`                          | Supabase PostgreSQL connection pool, jobs, reminders, audit structure |
| Storage              | Supabase Storage via `@supabase/supabase-js` | Private PDF object storage boundary                                   |
| Scheduler            | `node-cron`                                  | Periodic reminder enqueueing                                          |
| Jobs                 | PostgreSQL-backed `background_jobs` table    | Durable job enqueue, claim, retry, recovery                           |
| Tests                | Vitest, Supertest                            | Unit, integration, API route tests                                    |
| Frontend integration | CORS, JSON REST                              | React/Vite web app calls API routes                                   |
| LLM boundary         | Groq OpenAI-compatible chat completions      | Adapter wired for obligation extraction when `GROQ_API_KEY` is set    |
| OCR boundary         | Tesseract.js or Gemini Vision target         | Adapters exist, not wired to provider yet                             |
| Email boundary       | Console, Mailtrap, Resend target             | Console provider works; Mailtrap/Resend adapters are placeholders     |

## Runtime Entrypoints

### HTTP API

Entrypoint: `apps/api/src/server.ts`

Wiring:

1. `loadEnv()` parses process environment with Zod.
2. `createLogger(env)` creates the logger facade.
3. `createApp()` creates the Express application.
4. `registerWorkers({ logger })` and `registerSchedulers({ logger })` register no in-process workers/schedulers today; worker and scheduler have separate entrypoints.
5. `createGracefulShutdown(...)` wires process shutdown for the HTTP server and closeable registries.
6. Server listens on `API_HOST` and `API_PORT`.

HTTP middleware order in `apps/api/src/app.ts`:

1. Disable `x-powered-by`.
2. Apply CORS using `CORS_ORIGIN`.
3. Parse JSON bodies up to `1mb`.
4. Add request correlation IDs.
5. Register routes.
6. Apply 404 middleware.
7. Apply centralized error middleware.

### Background Worker

Entrypoint: `apps/api/src/jobs/worker-entry.ts`

Wiring:

1. Loads env, logger, and job config.
2. Creates `PgPoolClient` from `DATABASE_URL`.
3. Creates `PgTransactionManager` around the PostgreSQL pool.
4. Creates `PostgresJobRepository`.
5. Registers job processors in `ProcessorRegistry`:
   - `PROCESS_CONTRACT` -> `ContractProcessingProcessor`
   - `DELIVER_REMINDER` -> `ReminderDeliveryProcessor`
6. Creates `JobRunner`.
7. Creates `JobPoller`.
8. Starts `PollingLoop`.
9. Gracefully closes the polling loop and database pool on shutdown.

Important boundary: the worker job runner and durable job repository are wired, but the two processors intentionally throw "not implemented yet" after validating payload shape. This prevents fake successful processing before the actual contract extraction and reminder delivery workflows are implemented.

### Reminder Scheduler

Entrypoint: `apps/api/src/jobs/scheduler-entry.ts`

Wiring:

1. Loads env, logger, scheduler config, and job config.
2. Creates `PgPoolClient`.
3. Creates `PgTransactionManager`.
4. Creates `PostgresReminderSchedulerRepository`.
5. Creates `ReminderPoller`.
6. Uses `node-cron` with `SCHEDULER_CRON` and `REMINDER_CRON_TIMEZONE`.
7. On each cron tick, asks the repository to enqueue due reminders as `DELIVER_REMINDER` jobs.
8. Gracefully closes the cron task and database pool on shutdown.

## High-Level Flow

```text
Frontend
  |
  | HTTP JSON
  v
Express app
  |
  +--> /health
  +--> /api/obligations
  +--> /api/reminders
  +--> /api/kpi
  |
  v
Controllers
  |
  v
Services
  |
  v
Repository interfaces
  |
  v
PostgreSQL / Supabase Storage / External provider adapters
```

```text
Scheduler process
  |
  v
node-cron
  |
  v
ReminderPoller
  |
  v
PostgresReminderSchedulerRepository
  |
  +--> locks due reminders with PostgreSQL transactions
  +--> inserts idempotent DELIVER_REMINDER jobs
```

```text
Worker process
  |
  v
PollingLoop
  |
  v
JobPoller
  |
  v
JobRunner
  |
  +--> PostgresJobRepository.claimJobs(...)
  +--> ProcessorRegistry.dispatch(...)
  +--> PostgresJobRepository.markCompleted(...) or markFailed(...)
```

## HTTP Routes

| Route                  | Router                                      | Controller                  | Current behavior                                               |
| ---------------------- | ------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| `GET /health`          | `modules/health/health.routes.ts`           | Inline route handler        | Returns service health JSON                                    |
| `GET /api/obligations` | `modules/obligations/obligations.routes.ts` | `ObligationController.list` | Returns `501 NOT_IMPLEMENTED` until repository wiring is added |
| `GET /api/reminders`   | `modules/reminders/reminders.routes.ts`     | `ReminderController.list`   | Returns `501 NOT_IMPLEMENTED` until repository wiring is added |
| `GET /api/kpi/runs`    | `modules/kpi/kpi.routes.ts`                 | `KpiController.listRuns`    | Returns `501 NOT_IMPLEMENTED` until repository wiring is added |

## Service Inventory

### Configuration Services

| Component          | File                  | Responsibility                                                                                               |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Environment schema | `config/env.ts`       | Zod parsing for app, API, database, storage, Groq, OCR, email, JWT, jobs, scheduler, and logging variables |
| Database config    | `config/database.ts`  | Maps env to PostgreSQL pool config                                                                           |
| Job config         | `config/jobs.ts`      | Poll interval, batch size, lock duration, retry limits, worker ID                                            |
| Scheduler config   | `config/scheduler.ts` | Cron expression, timezone, reminder lookahead                                                                |
| Storage config     | `config/storage.ts`   | Supabase bucket and service-role storage config                                                              |
| Logger config      | `config/logger.ts`    | Logger facade used by API, worker, scheduler, notifications                                                  |

### Bootstrap and Shared HTTP Services

| Component           | File                                                  | Responsibility                                                  |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| App factory         | `app.ts`                                              | Creates Express app and middleware stack                        |
| Server runtime      | `server.ts`                                           | Starts HTTP process and shutdown handling                       |
| Route registration  | `bootstrap/register-routes.ts`                        | Mounts health, obligations, reminders, KPI routers              |
| Worker registry     | `bootstrap/register-workers.ts`                       | Placeholder registry for in-process workers; currently empty    |
| Scheduler registry  | `bootstrap/register-schedulers.ts`                    | Placeholder registry for in-process schedulers; currently empty |
| Graceful shutdown   | `bootstrap/graceful-shutdown.ts`                      | Closes registered resources on `SIGINT` and `SIGTERM`           |
| Request correlation | `shared/middleware/request-correlation.middleware.ts` | Adds correlation ID to request lifecycle                        |
| Async route wrapper | `shared/middleware/async-route.ts`                    | Forwards async route errors to Express error middleware         |
| 404 middleware      | `shared/middleware/not-found.middleware.ts`           | Normalizes missing-route errors                                 |
| Error middleware    | `shared/middleware/error.middleware.ts`               | Normalizes application and unknown errors                       |
| Request validation  | `shared/middleware/validate-request.middleware.ts`    | Validates request bodies, params, and query payloads with Zod   |

### Database and Transaction Services

| Component           | File                                             | Responsibility                                                     |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| PostgreSQL client   | `infrastructure/database/postgres-client.ts`     | Creates a bounded `pg` pool and exposes typed query calls          |
| Transaction manager | `infrastructure/database/transaction-manager.ts` | Runs operations inside PostgreSQL transactions                     |
| Health check        | `infrastructure/database/health-check.ts`        | Database health boundary                                           |
| Migration package   | `packages/database/migrations/*`                 | PostgreSQL schema migrations, including durable jobs and reminders |

### Storage Services

| Component                 | File                                                  | Responsibility                                                       |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Storage interface         | `infrastructure/storage/storage-provider.ts`          | Defines upload, download, delete, and signed URL operations          |
| Supabase storage provider | `infrastructure/storage/supabase-storage.provider.ts` | Uses Supabase Storage service role for private PDF object operations |
| Object key helper         | `infrastructure/storage/object-key.ts`                | Creates sanitized, deterministic object key prefixes                 |

### Job Services

| Component             | File                                               | Responsibility                                                                   |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Job types             | `jobs/job.types.ts`                                | Shared job record and input types                                                |
| Job keys              | `jobs/job-keys.ts`                                 | Idempotency keys for contract processing and reminder delivery                   |
| Retry policy          | `jobs/retry-policy.ts`                             | Permanent/retryable error classes and exponential retry calculation              |
| Job repository        | `jobs/job.repository.ts`                           | Creates, claims, completes, fails, and recovers PostgreSQL-backed jobs           |
| Job runner            | `jobs/job-runner.ts`                               | Coordinates claim, processor execution, completion, and failure recording        |
| Processor registry    | `jobs/processors/processor-registry.ts`            | Maps `job_type` values to processors                                             |
| Contract processor    | `jobs/processors/contract-processing.processor.ts` | Validates `PROCESS_CONTRACT` payload; full workflow not implemented yet          |
| Reminder processor    | `jobs/processors/reminder-delivery.processor.ts`   | Validates `DELIVER_REMINDER` payload; full delivery workflow not implemented yet |
| Job poller            | `jobs/pollers/job-poller.ts`                       | Invokes one worker polling cycle                                                 |
| Polling loop          | `jobs/pollers/polling-loop.ts`                     | Repeats polling at configured interval                                           |
| Expired job recovery  | `jobs/recovery/recover-expired-jobs.ts`            | Calls repository lock recovery                                                   |
| Expired lock helper   | `jobs/recovery/expired-lock.ts`                    | Determines lock expiry behavior                                                  |
| Contract job producer | `jobs/producers/contract-processing.producer.ts`   | Enqueues idempotent `PROCESS_CONTRACT` jobs                                      |
| Reminder job producer | `jobs/producers/reminder.producer.ts`              | Enqueues idempotent `DELIVER_REMINDER` jobs                                      |
| Worker entrypoint     | `jobs/worker-entry.ts`                             | Wires worker runtime dependencies                                                |

### Scheduler Services

| Component                     | File                                                          | Responsibility                                                             |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Reminder poller               | `jobs/schedulers/reminder-poller.ts`                          | Computes lookahead window and asks repository to enqueue due reminders     |
| Reminder scheduler repository | `modules/reminders/postgres-reminder-scheduler.repository.ts` | Claims due reminders and inserts idempotent delivery jobs in a transaction |
| Obligation state scheduler    | `jobs/schedulers/obligation-state.scheduler.ts`               | Placeholder boundary for future automated obligation state transitions     |
| Scheduler entrypoint          | `jobs/scheduler-entry.ts`                                     | Wires cron runtime dependencies                                            |
| Expired reminder recovery     | `jobs/recovery/recover-expired-reminders.ts`                  | Placeholder boundary for recovering reminder leases                        |

### Contract Services

| Component                     | File                                           | Responsibility                                                            |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Contract service              | `modules/contracts/contracts.service.ts`       | Checks duplicate uploads by SHA-256 and protects unique uploads           |
| Contract repository interface | `modules/contracts/contracts.repository.ts`    | Persistence contract for finding, creating, and status-updating contracts |
| Contract state machine        | `modules/contracts/contracts.state-machine.ts` | Contract processing status transition boundary                            |
| Contract types                | `modules/contracts/contracts.types.ts`         | Contract upload and record types                                          |

Current status: service and repository contracts exist. No HTTP contract upload route is currently mounted, and no PostgreSQL repository implementation is wired yet.

### Document Processing Services

| Component                    | File                                                         | Responsibility                                                    |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Document processing service  | `modules/document-processing/document-processing.service.ts` | Delegates parsing to a `DocumentTextExtractor`                    |
| Document types               | `modules/document-processing/document-processing.types.ts`   | Extraction input and parsed document contracts                    |
| Text normalizer              | `modules/document-processing/text-normalizer.ts`             | Text normalization utility                                        |
| Native PDF extractor adapter | `infrastructure/pdf/native-pdf-text-extractor.adapter.ts`    | Validates PDF header and marks native extraction as not wired yet |
| PDF validator                | `infrastructure/pdf/pdf-validator.ts`                        | Checks whether bytes look like a PDF                              |

Current status: the service boundary is present, but native PDF extraction is not yet wired to `pdfjs-dist` or `pdf-parse`.

### OCR Services

| Component              | File                                          | Responsibility                             |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| OCR provider interface | `infrastructure/ocr/ocr-provider.ts`          | Defines OCR input and result shape         |
| Tesseract adapter      | `infrastructure/ocr/tesseract.adapter.ts`     | Placeholder for Tesseract.js OCR           |
| Gemini Vision adapter  | `infrastructure/ocr/gemini-vision.adapter.ts` | Placeholder for Gemini Vision OCR fallback |

Current status: interfaces and adapter boundaries exist; OCR providers are not functional yet.

### Extraction and LLM Services

| Component                       | File                                               | Responsibility                               |
| ------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Extraction service              | `modules/extraction/extraction.service.ts`         | Validates LLM structured output with Zod     |
| Extraction schemas              | `modules/extraction/extraction.schemas.ts`         | Zod schemas for structured extraction output |
| Extraction repository interface | `modules/extraction/extraction.repository.ts`      | Persistence contract for extraction records  |
| Prompt builder                  | `modules/extraction/prompt-builder.ts`             | Prompt construction boundary                 |
| Confidence evaluator            | `modules/extraction/confidence-evaluator.ts`       | Confidence scoring boundary                  |
| LLM provider interface          | `infrastructure/llm/llm-provider.ts`               | Structured generation contract               |
| Groq adapter                    | `infrastructure/llm/groq.adapter.ts`               | OpenAI-compatible chat completions adapter for structured extraction |
| Structured parser               | `infrastructure/llm/structured-response-parser.ts` | Structured response parsing boundary         |

Current status: validation and boundaries exist; Groq obligation extraction is wired into the contract-processing worker when `GROQ_API_KEY` is configured.

### Source Anchoring Services

| Component               | File                                                  | Responsibility                          |
| ----------------------- | ----------------------------------------------------- | --------------------------------------- |
| Source anchor validator | `modules/source-anchoring/source-anchor-validator.ts` | Validates page/line anchoring structure |
| Source anchoring types  | `modules/source-anchoring/source-anchoring.types.ts`  | Source evidence and anchor types        |

Current status: framework-independent validation boundary exists; it is not yet integrated into a full extraction workflow.

### Review Services

| Component                   | File                                  | Responsibility                                 |
| --------------------------- | ------------------------------------- | ---------------------------------------------- |
| Review service              | `modules/review/review.service.ts`    | Lists pending candidates and records decisions |
| Review repository interface | `modules/review/review.repository.ts` | Persistence contract for review queue state    |
| Review types                | `modules/review/review.types.ts`      | Human review decision and candidate types      |

Current status: service and repository interface exist. HTTP review routes are not mounted yet.

### Obligation Services

| Component                               | File                                                   | Responsibility                                                             |
| --------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Obligation route                        | `modules/obligations/obligations.routes.ts`            | Mounts obligation HTTP endpoints                                           |
| Obligation controller                   | `modules/obligations/obligations.controller.ts`        | Returns `501` for listing until persistence is wired                       |
| Obligation service                      | `modules/obligations/obligations.service.ts`           | Validates state transition, updates obligation, records transition history |
| Obligation state machine                | `modules/obligations/obligation.state-machine.ts`      | Enforces allowed obligation status transitions                             |
| Obligation repository interface         | `modules/obligations/obligations.repository.ts`        | Persistence contract for obligations                                       |
| Transition history repository interface | `modules/obligations/transition-history.repository.ts` | Persistence contract for audit-like transition history                     |
| Obligation schemas                      | `modules/obligations/obligations.schemas.ts`           | Zod request validation schemas                                             |

Current status: transition business logic exists, but route/controller persistence is not wired.

### Reminder Services

| Component                       | File                                                          | Responsibility                                                                                      |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Reminder route                  | `modules/reminders/reminders.routes.ts`                       | Mounts reminder HTTP endpoints                                                                      |
| Reminder controller             | `modules/reminders/reminders.controller.ts`                   | Returns `501` for listing until persistence is wired                                                |
| Reminder service                | `modules/reminders/reminders.service.ts`                      | Creates occurrence keys, schedules reminders, and claims due reminders through repository interface |
| Reminder repository interface   | `modules/reminders/reminders.repository.ts`                   | Persistence contract for reminder CRUD, status changes, lease recovery, and scheduler enqueueing    |
| PostgreSQL scheduler repository | `modules/reminders/postgres-reminder-scheduler.repository.ts` | Transactionally enqueues due reminder jobs                                                          |
| Occurrence key helper           | `modules/reminders/reminder-occurrence-key.ts`                | Creates deterministic reminder occurrence keys                                                      |
| Reminder types                  | `modules/reminders/reminders.types.ts`                        | Reminder status and delivery attempt types                                                          |

Current status: scheduler-side PostgreSQL enqueueing is wired. User-facing reminder retrieval and delivery completion are not wired yet.

### Notification and Email Services

| Component                       | File                                                     | Responsibility                                                  |
| ------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| Notification provider interface | `modules/notifications/notifications.types.ts`           | Defines provider-independent send contract                      |
| Console notification provider   | `modules/notifications/console-notification.provider.ts` | Logs notification previews and returns accepted status          |
| Email provider alias            | `infrastructure/email/email-provider.ts`                 | Bridges email-specific naming to notification provider contract |
| Mailtrap adapter                | `infrastructure/email/mailtrap.adapter.ts`               | Placeholder for Mailtrap email delivery                         |
| Resend adapter                  | `infrastructure/email/resend.adapter.ts`                 | Placeholder for Resend email delivery                           |

Current status: console notification provider is functional for local preview. External email adapters are not wired yet.

### Audit Services

| Component                  | File                                | Responsibility                                                                                          |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Audit service              | `modules/audit/audit.service.ts`    | Appends audit events with actor, action, entity, before/after data, correlation ID, and clock timestamp |
| Audit repository interface | `modules/audit/audit.repository.ts` | Persistence contract for audit logs                                                                     |
| Audit types                | `modules/audit/audit.types.ts`      | Actor and audit event type contracts                                                                    |

Current status: service boundary exists; PostgreSQL repository implementation is not wired yet.

### Auth Services

| Component  | File                         | Responsibility                                    |
| ---------- | ---------------------------- | ------------------------------------------------- |
| Auth types | `modules/auth/auth.types.ts` | Authentication identity and session type boundary |
| Auth index | `modules/auth/index.ts`      | Module export boundary                            |

Current status: auth types exist. JWT verification and auth middleware are not implemented yet.

### KPI Services

| Component                | File                            | Responsibility                                        |
| ------------------------ | ------------------------------- | ----------------------------------------------------- |
| KPI route                | `modules/kpi/kpi.routes.ts`     | Mounts KPI HTTP endpoints                             |
| KPI controller           | `modules/kpi/kpi.controller.ts` | Returns `501` for KPI runs until persistence is wired |
| KPI service              | `modules/kpi/kpi.service.ts`    | Delegates KPI run listing to repository               |
| KPI repository interface | `modules/kpi/kpi.repository.ts` | Persistence contract for KPI reports                  |
| KPI types                | `modules/kpi/kpi.types.ts`      | KPI run and metric type contracts                     |

Current status: service and route boundary exist. KPI computation and persistence are not implemented yet.

## Persistence and Transaction Boundaries

The current production-oriented persistence design centers on PostgreSQL:

- `background_jobs` stores durable jobs with status, attempts, idempotency key, priority, availability, lock ownership, and completion metadata.
- `reminders` stores reminder schedule records and uses deterministic occurrence keys.
- `reminder_delivery_attempts` stores delivery-attempt history.
- `audit_events` stores immutable audit facts.

Durable job claiming uses short PostgreSQL transactions and `FOR UPDATE SKIP LOCKED`. The worker does not hold a database transaction while executing processor logic. It claims jobs, commits, executes the processor, then records completion or failure.

Reminder enqueueing also uses a short transaction. The scheduler claims due reminders, marks them `ENQUEUED`, and inserts `DELIVER_REMINDER` jobs with idempotency protection.

## Environment Variables by Concern

| Concern          | Variables                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application      | `NODE_ENV`, `APP_NAME`, `APP_BASE_URL`                                                                                                                 |
| API              | `API_HOST`, `API_PORT`, `CORS_ORIGIN`                                                                                                                  |
| PostgreSQL       | `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_IDLE_TIMEOUT_MS`                                      |
| Supabase Storage | `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`                                                             |
| Groq             | `GROQ_API_KEY`, `GROQ_EXTRACTION_MODEL`, `GROQ_EXTRACTION_TEMPERATURE`, `GROQ_EXTRACTION_MAX_TOKENS`                                                    |
| OCR              | `OCR_PROVIDER`, `TESSERACT_WORKER_COUNT`                                                                                                               |
| Email            | `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`                                                                 |
| JWT              | `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_TTL_SECONDS`                                                                             |
| Jobs             | `JOB_POLL_INTERVAL_MS`, `JOB_BATCH_SIZE`, `JOB_LOCK_DURATION_MS`, `JOB_MAX_ATTEMPTS`, `JOB_RETRY_BASE_DELAY_MS`, `JOB_RETRY_MAX_DELAY_MS`, `WORKER_ID` |
| Scheduler        | `REMINDER_CRON_TIMEZONE`, `SCHEDULER_CRON`, `REMINDER_LOOKAHEAD_MINUTES`                                                                               |
| Logging          | `LOG_LEVEL`, `LOG_FORMAT`                                                                                                                              |

## Current Status Summary

Implemented and wired:

- Express app creation and middleware stack.
- Health route.
- Environment validation.
- PostgreSQL pool and transaction manager.
- Supabase Storage provider boundary.
- PostgreSQL-backed job repository with idempotency, claiming, retry, completion, failure, and expired lock recovery.
- Worker runtime dependency graph.
- Scheduler runtime dependency graph.
- Reminder scheduler repository for durable reminder job enqueueing.
- Console notification provider.
- Unit tests around state machines, job keys, retry policy, object keys, env parsing, and API error handling.

Prepared but not fully functional:

- Contract upload HTTP route.
- Contract PostgreSQL repository implementation.
- Native PDF extraction.
- OCR extraction.
- Groq structured extraction.
- Source anchoring integration into extraction workflow.
- Review HTTP routes and persistence implementation.
- Obligation HTTP persistence implementation.
- Reminder HTTP persistence implementation.
- Reminder delivery processor implementation.
- External email providers.
- Audit repository implementation.
- Auth middleware and JWT verification.
- KPI computation and KPI repository implementation.

## Commands

```bash
corepack pnpm --filter @contract-obligation-tracker/api run dev
corepack pnpm --filter @contract-obligation-tracker/api run worker
corepack pnpm --filter @contract-obligation-tracker/api run scheduler
corepack pnpm --filter @contract-obligation-tracker/api run typecheck
corepack pnpm --filter @contract-obligation-tracker/api run test
```
