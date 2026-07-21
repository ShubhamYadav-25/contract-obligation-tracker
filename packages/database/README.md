# Database Package

This package holds database migrations, seeds, and database-adjacent scripts.

The contract schema is intentionally not designed in this setup task. Future migrations should be written as versioned, reviewable files under `migrations/` and should preserve transactional integrity where the underlying database operation supports it.

## Current Migration Direction

The backend now uses Supabase PostgreSQL through `DATABASE_URL`. Background work is represented by PostgreSQL tables, not Redis or BullMQ.

The first additive migration is:

- `migrations/202607200001_supabase_postgres_jobs.up.sql`
- `migrations/202607200001_supabase_postgres_jobs.down.sql`

It creates durable background jobs, reminder occurrence uniqueness, reminder delivery attempts, and audit events.
