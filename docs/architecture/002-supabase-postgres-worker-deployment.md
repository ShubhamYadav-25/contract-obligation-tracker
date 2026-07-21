# Supabase PostgreSQL Worker Deployment

## Runtime Processes

Run these as explicit processes:

- API process: serves HTTP requests.
- Worker process: polls PostgreSQL `background_jobs`, claims work with row locks, executes processors, and records success or retry state.
- Scheduler process: runs cron ticks that scan PostgreSQL for due reminders and enqueue delivery jobs idempotently.

For a short prototype, worker and scheduler may run in the same Render service if the startup command is explicit and graceful shutdown is enabled. Correctness must still come from PostgreSQL uniqueness and `FOR UPDATE SKIP LOCKED`, not from a single process assumption.

## Commands

```sh
corepack pnpm --filter @contract-obligation-tracker/api start
corepack pnpm --filter @contract-obligation-tracker/api worker
corepack pnpm --filter @contract-obligation-tracker/api scheduler
```

For development:

```sh
corepack pnpm --filter @contract-obligation-tracker/api dev
```

## Required Environment

- `DATABASE_URL`: Supabase PostgreSQL connection string.
- `DATABASE_SSL`: usually `true` for Supabase-hosted PostgreSQL.
- `DATABASE_POOL_MAX`: bounded PostgreSQL pool size.
- `DATABASE_CONNECTION_TIMEOUT_MS`: connection timeout.
- `DATABASE_IDLE_TIMEOUT_MS`: idle pool timeout.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service-role key. Never expose to the frontend.
- `SUPABASE_STORAGE_BUCKET`: private bucket for contract PDFs and generated binary objects.
- `JOB_POLL_INTERVAL_MS`: worker polling interval.
- `JOB_BATCH_SIZE`: maximum jobs claimed per poll.
- `JOB_LOCK_DURATION_MS`: processing lease duration.
- `JOB_MAX_ATTEMPTS`: default retry limit for new jobs.
- `JOB_RETRY_BASE_DELAY_MS`: exponential backoff base delay.
- `JOB_RETRY_MAX_DELAY_MS`: exponential backoff cap.
- `WORKER_ID`: stable identifier for the worker instance.
- `SCHEDULER_CRON`: cron expression for due-reminder scans.

## Removed Infrastructure

Redis, Upstash Redis, BullMQ queues, queue events, and BullMQ job IDs are not part of the runtime architecture. Durable work state is stored in Supabase PostgreSQL.

## Transaction Boundaries

Job claiming and reminder enqueueing use short PostgreSQL transactions. External calls such as storage, OCR, LLM, and email delivery must happen after the claim transaction commits.

## Delivery Semantics

Reminder delivery is at-least-once. The durable occurrence key and reminder attempt history provide idempotent logical identity and auditability. The system must not claim exactly-once external email delivery.
