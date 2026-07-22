ALTER TABLE contract_processing_runs
DROP CONSTRAINT IF EXISTS contract_processing_runs_status_check;

ALTER TABLE contract_processing_runs
ADD CONSTRAINT contract_processing_runs_status_check
CHECK (status IN (
  'RECEIVED',
  'STORED',
  'QUEUED',
  'PROCESSING',
  'PARSING',
  'OCR_PROCESSING',
  'TEXT_SEGMENTED',
  'COMPLETED',
  'REVIEW_REQUIRED',
  'FAILED'
));

CREATE TABLE IF NOT EXISTS document_text_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  processing_run_id UUID NOT NULL REFERENCES contract_processing_runs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('PDF_TEXT', 'TESSERACT', 'GEMINI_VISION')),
  raw_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  char_count INTEGER NOT NULL CHECK (char_count >= 0),
  word_count INTEGER NOT NULL CHECK (word_count >= 0),
  printable_ratio NUMERIC(6, 5) NOT NULL CHECK (printable_ratio >= 0 AND printable_ratio <= 1),
  ocr_confidence NUMERIC(6, 3) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100),
  page_width NUMERIC(12, 4),
  page_height NUMERIC(12, 4),
  segments JSONB NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_text_pages_document_page UNIQUE (document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_document_text_pages_contract
ON document_text_pages (organization_id, contract_id, page_number);

CREATE INDEX IF NOT EXISTS idx_document_text_pages_processing_run
ON document_text_pages (processing_run_id);
