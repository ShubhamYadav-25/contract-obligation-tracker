-- Add status column to extraction_candidates for review workflow
ALTER TABLE IF EXISTS extraction_candidates
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW';

ALTER TABLE IF EXISTS extraction_candidates
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;
