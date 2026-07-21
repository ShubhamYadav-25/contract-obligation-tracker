ALTER TABLE contract_processing_runs
DROP CONSTRAINT IF EXISTS contract_processing_runs_status_check;

ALTER TABLE contract_processing_runs
ADD CONSTRAINT contract_processing_runs_status_check
CHECK (status IN (
  'RECEIVED',
  'STORED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'REVIEW_REQUIRED',
  'FAILED'
));

ALTER TABLE contract_processing_runs
ADD COLUMN IF NOT EXISTS error_stage TEXT,
ADD COLUMN IF NOT EXISTS error_retryable BOOLEAN,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contract_processing_runs_claimable
ON contract_processing_runs (id, status, attempt_number);
