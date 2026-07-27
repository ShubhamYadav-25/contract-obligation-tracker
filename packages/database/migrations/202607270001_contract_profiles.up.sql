CREATE TABLE IF NOT EXISTS contract_profiles (
  contract_id UUID PRIMARY KEY REFERENCES contracts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  parties TEXT[] NOT NULL DEFAULT '{}',
  contract_value NUMERIC(18,2),
  currency CHAR(3),
  effective_date DATE,
  expiration_date DATE,
  renewal_type TEXT,
  notice_period_days INTEGER CHECK (notice_period_days IS NULL OR notice_period_days >= 0),
  next_obligation_summary TEXT,
  extraction_confidence NUMERIC(4,3)
    CHECK (
      extraction_confidence IS NULL
      OR (extraction_confidence >= 0 AND extraction_confidence <= 1)
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expiration_date IS NULL OR effective_date IS NULL OR expiration_date >= effective_date),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_contract_profiles_organization
ON contract_profiles (organization_id, updated_at DESC);
