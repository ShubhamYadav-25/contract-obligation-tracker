CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM (
      'PENDING',
      'PROCESSING',
      'RETRY_PENDING',
      'COMPLETED',
      'FAILED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_status') THEN
    CREATE TYPE reminder_status AS ENUM (
      'PENDING',
      'ENQUEUED',
      'PROCESSING',
      'DELIVERED',
      'RETRY_PENDING',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_delivery_attempt_status') THEN
    CREATE TYPE reminder_delivery_attempt_status AS ENUM (
      'STARTED',
      'DELIVERED',
      'FAILED',
      'UNKNOWN'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status job_status NOT NULL DEFAULT 'PENDING',
  priority INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  locked_by VARCHAR(255),
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_background_job_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_claimable
ON background_jobs (priority DESC, available_at, created_at)
WHERE status IN ('PENDING', 'RETRY_PENDING');

CREATE INDEX IF NOT EXISTS idx_background_jobs_expired_locks
ON background_jobs (lock_expires_at)
WHERE status = 'PROCESSING';

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  occurrence_key VARCHAR(255) NOT NULL,
  status reminder_status NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  lease_expires_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reminders_occurrence_key UNIQUE (occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_reminders_due
ON reminders (scheduled_for, created_at)
WHERE status IN ('PENDING', 'RETRY_PENDING');

CREATE TABLE IF NOT EXISTS reminder_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider VARCHAR(100) NOT NULL,
  status reminder_delivery_attempt_status NOT NULL,
  provider_message_id VARCHAR(255),
  error_code VARCHAR(100),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_reminder_attempt_number UNIQUE (reminder_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  correlation_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
ON audit_events (entity_type, entity_id, created_at DESC);
