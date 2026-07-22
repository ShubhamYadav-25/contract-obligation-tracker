CREATE TABLE IF NOT EXISTS inbox_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  obligation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inbox_entries_reminder UNIQUE (reminder_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_entries_created_at
ON inbox_entries (created_at DESC);
