DROP INDEX IF EXISTS idx_audit_events_entity;
DROP TABLE IF EXISTS audit_events;

DROP TABLE IF EXISTS reminder_delivery_attempts;

DROP INDEX IF EXISTS idx_reminders_due;
DROP TABLE IF EXISTS reminders;

DROP INDEX IF EXISTS idx_background_jobs_expired_locks;
DROP INDEX IF EXISTS idx_background_jobs_claimable;
DROP TABLE IF EXISTS background_jobs;

DROP TYPE IF EXISTS reminder_delivery_attempt_status;
DROP TYPE IF EXISTS reminder_status;
DROP TYPE IF EXISTS job_status;
