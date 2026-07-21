ALTER TABLE contract_documents
ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'STORED',
ADD COLUMN IF NOT EXISTS upload_error_code TEXT,
ADD COLUMN IF NOT EXISTS upload_error_message TEXT,
ADD COLUMN IF NOT EXISTS upload_failed_at TIMESTAMPTZ;

ALTER TABLE contract_documents
DROP CONSTRAINT IF EXISTS contract_documents_upload_status_check;

ALTER TABLE contract_documents
ADD CONSTRAINT contract_documents_upload_status_check
CHECK (upload_status IN ('PENDING_UPLOAD', 'STORED', 'UPLOAD_FAILED'));

ALTER TABLE contract_documents
DROP CONSTRAINT IF EXISTS uq_contract_documents_org_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_documents_org_hash_active
ON contract_documents (organization_id, file_hash_sha256)
WHERE upload_status IN ('PENDING_UPLOAD', 'STORED');
