DROP INDEX IF EXISTS uq_contract_documents_org_hash_active;

ALTER TABLE contract_documents
DROP CONSTRAINT IF EXISTS contract_documents_upload_status_check;

ALTER TABLE contract_documents
ADD CONSTRAINT uq_contract_documents_org_hash
UNIQUE (organization_id, file_hash_sha256);

ALTER TABLE contract_documents
DROP COLUMN IF EXISTS upload_failed_at,
DROP COLUMN IF EXISTS upload_error_message,
DROP COLUMN IF EXISTS upload_error_code,
DROP COLUMN IF EXISTS upload_status;
