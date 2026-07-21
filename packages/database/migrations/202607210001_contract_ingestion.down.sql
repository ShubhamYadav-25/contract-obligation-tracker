DROP INDEX IF EXISTS idx_contract_processing_runs_document;
DROP INDEX IF EXISTS idx_contract_processing_runs_contract;
DROP INDEX IF EXISTS idx_contract_documents_org_hash;
DROP INDEX IF EXISTS idx_contract_documents_contract;
DROP INDEX IF EXISTS idx_contracts_organization;

DROP TABLE IF EXISTS contract_processing_runs;

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS fk_contracts_current_document;

DROP TABLE IF EXISTS contract_documents;
DROP TABLE IF EXISTS contracts;
