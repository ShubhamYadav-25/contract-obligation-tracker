# Supabase PostgreSQL Job Migration Report

## Current Infrastructure Usage

This repository currently contains a scaffolded backend. No production repository implementation, Neon client, Upstash client, Redis client, BullMQ worker, or BullMQ queue dependency is present.

## Files That Use Neon

None found.

## Files That Use Redis Or Upstash

- `apps/api/src/config/redis.ts`
- `apps/api/src/config/queue.ts`
- `.env.example`

These are configuration placeholders only. No Redis client dependency or runtime connection exists.

## Files That Use BullMQ Concepts

- `apps/api/src/infrastructure/queue/bullmq-connection.factory.ts`
- `apps/api/src/infrastructure/queue/job-options.ts`
- `apps/api/src/infrastructure/queue/producer.ts`
- `apps/api/src/infrastructure/queue/queue-names.ts`
- `apps/api/src/jobs/producers/contract-processing.producer.ts`
- `apps/api/src/jobs/producers/reminder.producer.ts`
- `apps/api/src/jobs/workers/contract-processing.worker.ts`
- `apps/api/src/jobs/workers/reminder-delivery.worker.ts`

These are queue-shaped placeholders only. No `bullmq`, `ioredis`, or Upstash dependency is installed.

## Files That Use Supabase

- `apps/api/src/config/storage.ts`
- `apps/api/src/infrastructure/storage/supabase-storage.adapter.ts`
- `.env.example`

The existing Supabase storage adapter is an unwired safe stub.

## Jobs That Must Be Migrated

- Contract processing: replace queue producer placeholder with PostgreSQL `background_jobs` insertion using deterministic idempotency key.
- Reminder delivery: keep reminders as business records and enqueue PostgreSQL jobs idempotently.

## Obsolete Environment Variables

- `REDIS_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The project did not contain `NEON_DATABASE_URL`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, or `BULLMQ_PREFIX`.

## Migration Direction

- Use `DATABASE_URL` as the Supabase PostgreSQL connection string.
- Use direct PostgreSQL access for transactions, row locking, constraints, optimistic concurrency, and `FOR UPDATE SKIP LOCKED`.
- Use Supabase Storage for contract binaries through a provider abstraction.
- Use PostgreSQL-backed background jobs for contract processing and reminder delivery.
- Use cron only to enqueue due reminder delivery jobs; cron callbacks must not send notifications directly.
