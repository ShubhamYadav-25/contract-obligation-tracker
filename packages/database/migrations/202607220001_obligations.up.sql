-- Create obligation_status enum and obligations tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'obligation_status') THEN
    CREATE TYPE obligation_status AS ENUM ('UPCOMING', 'DUE', 'MET', 'MISSED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status obligation_status NOT NULL DEFAULT 'UPCOMING',
  due_at TIMESTAMPTZ,
  anchors JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS obligation_transition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
  from_status obligation_status NOT NULL,
  to_status obligation_status NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obligations_contract_id ON obligations (contract_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_at ON obligations (due_at) WHERE due_at IS NOT NULL;
