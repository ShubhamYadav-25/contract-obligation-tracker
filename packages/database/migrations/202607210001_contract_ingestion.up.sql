CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  external_ref TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT')),
  current_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  original_filename TEXT NOT NULL CHECK (length(trim(original_filename)) > 0),
  storage_provider TEXT NOT NULL CHECK (length(trim(storage_provider)) > 0),
  storage_bucket TEXT NOT NULL CHECK (length(trim(storage_bucket)) > 0),
  storage_key TEXT NOT NULL CHECK (length(trim(storage_key)) > 0),
  mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  file_hash_sha256 CHAR(64) NOT NULL CHECK (file_hash_sha256 ~ '^[a-f0-9]{64}$'),
  source_type TEXT NOT NULL CHECK (source_type IN ('USER_UPLOAD', 'CUAD_SEED')),
  source_reference TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contract_documents_storage_key UNIQUE (storage_key),
  CONSTRAINT uq_contract_documents_contract_version UNIQUE (contract_id, version_number),
  CONSTRAINT uq_contract_documents_org_hash UNIQUE (organization_id, file_hash_sha256)
);

ALTER TABLE contracts
ADD CONSTRAINT fk_contracts_current_document
FOREIGN KEY (current_document_id)
REFERENCES contract_documents(id)
ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS contract_processing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'STORED', 'QUEUED', 'FAILED')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  queue_job_id TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_organization
ON contracts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_documents_contract
ON contract_documents (contract_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_contract_documents_org_hash
ON contract_documents (organization_id, file_hash_sha256);

CREATE INDEX IF NOT EXISTS idx_contract_processing_runs_contract
ON contract_processing_runs (contract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_processing_runs_document
ON contract_processing_runs (document_id, created_at DESC);

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
