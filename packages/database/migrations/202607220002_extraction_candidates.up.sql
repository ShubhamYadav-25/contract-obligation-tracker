-- Create extraction_candidates table for low-confidence extraction review
CREATE TABLE IF NOT EXISTS extraction_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  document_id UUID NOT NULL,
  extracted_json JSONB NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  validation_issues TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extraction_candidates_contract_id ON extraction_candidates (contract_id);
