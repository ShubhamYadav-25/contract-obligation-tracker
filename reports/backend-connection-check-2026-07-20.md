# Backend Connection and Runtime Check

Date: 2026-07-20

This report uses the local ignored `.env` file. No secret values are included.

## Summary

The application can start locally, and all configured external providers are reachable with the current `.env` values.

One backend readiness issue remains: the PostgreSQL connection works, but the expected durable job table `public.background_jobs` does not exist yet. Worker and scheduler flows that depend on PostgreSQL-backed jobs require the database migration to be applied before they can be considered ready.

## Local Config Fix Applied

- Updated local `.env` `DATABASE_URL` to use the new Supabase shared-pooler password.
- `.env` is ignored by Git.
- `.env.example` was not updated in this check.

## Connection Results

| Component                   | Result       | Details                                                                                             |
| --------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| PostgreSQL                  | Passed       | Connected to database `postgres`, schema `public`; server-time query succeeded                      |
| PostgreSQL schema readiness | Needs action | `public.background_jobs` does not exist                                                             |
| Supabase Storage            | Passed       | Storage API reachable; configured bucket `contract_obligation_tracker_bucket` exists and is private |
| Gemini                      | Passed       | API reachable; configured model is `gemini-2.5-flash`; provider returned HTTP 200                   |
| Email SMTP                  | Passed       | TCP connection succeeded; STARTTLS succeeded; SMTP authentication succeeded; no email was sent      |
| JWT                         | Passed       | Local HS256 signing and verification succeeded; issuer and audience are configured                  |

## Application Runtime Smoke Test

| Check                           | Result           |
| ------------------------------- | ---------------- |
| Root dev command starts API     | Passed           |
| Root dev command starts web app | Passed           |
| `GET /health` on API            | Passed, HTTP 200 |

The smoke-test wrapper forcibly stopped the dev processes after verification, which can cause a nonzero shell exit even when the app boot checks pass.

## Validation Commands

| Command                                                                         | Result                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `corepack pnpm --filter @contract-obligation-tracker/api run check:connections` | Passed                                                                   |
| `corepack pnpm typecheck`                                                       | Passed                                                                   |
| `corepack pnpm test`                                                            | Passed; API integration tests remain skipped without `TEST_DATABASE_URL` |
| `corepack pnpm build`                                                           | Passed                                                                   |

## Required Next Step

Apply the PostgreSQL migration before running worker and scheduler workflows:

- `packages/database/migrations/202607200001_supabase_postgres_jobs.up.sql`

That migration creates the PostgreSQL-backed job, reminder, delivery-attempt, and audit tables needed by durable backend workflows.
