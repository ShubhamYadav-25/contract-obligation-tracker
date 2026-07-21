DROP INDEX IF EXISTS idx_contract_processing_runs_claimable;

ALTER TABLE contract_processing_runs
DROP COLUMN IF EXISTS failed_at,
DROP COLUMN IF EXISTS error_retryable,
DROP COLUMN IF EXISTS error_stage;

ALTER TABLE contract_processing_runs
DROP CONSTRAINT IF EXISTS contract_processing_runs_status_check;

ALTER TABLE contract_processing_runs
ADD CONSTRAINT contract_processing_runs_status_check
CHECK (status IN ('RECEIVED', 'STORED', 'QUEUED', 'FAILED'));
