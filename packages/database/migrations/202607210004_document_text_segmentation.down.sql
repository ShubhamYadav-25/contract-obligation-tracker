DROP INDEX IF EXISTS idx_document_text_pages_processing_run;
DROP INDEX IF EXISTS idx_document_text_pages_contract;
DROP TABLE IF EXISTS document_text_pages;

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
