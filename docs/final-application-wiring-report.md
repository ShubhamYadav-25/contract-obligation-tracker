# Final Application Wiring Report

Generated: 2026-07-24

## Application Path

`corepack pnpm dev` starts the local app from the repository root. The root script runs both app workspaces:

- API: `apps/api/src/server.ts`
- Web: `apps/web` Vite dev server
- Worker and scheduler: embedded in `server.ts` through `registerWorkers(...)` and `registerSchedulers(...)`

The API worker runtime registers `PROCESS_CONTRACT` and `DELIVER_REMINDER`. The scheduler runtime registers `REMINDER_SCHEDULER`.

## Backend Surface

- Upload: `POST /api/v1/contracts`
- Contract list/detail: `GET /api/v1/contracts`, `GET /api/v1/contracts/:contractId`
- Processing status: `GET /api/v1/contracts/:contractId/processing-status`
- Text pages: `GET /api/v1/contracts/:contractId/text-pages`
- Authenticated PDF stream: `GET /api/v1/contracts/:contractId/document.pdf`
- Obligation list/detail: `GET /api/obligations`, `GET /api/obligations/:obligationId`
- Obligation status transition: `PATCH /api/obligations/:obligationId/status`

Auth context is supplied by `x-user-id` and `x-organization-id` headers.

## Frontend Surface

- Dashboard: `/dashboard`
- Contracts and upload workflow: `/contracts`
- Contract workspace: `/contracts/:contractId`
- Obligations: `/obligations`
- Obligation detail: `/obligations/:obligationId`

The frontend API client is `apps/web/src/services/api-client.ts`. It reads `VITE_API_BASE_URL`, `VITE_DEV_USER_ID`, and `VITE_DEV_ORGANIZATION_ID`.

## Environment

`.env` is ignored by git (`.gitignore:10`). `.env.example` uses placeholders and documents the local reference-aware Gemini settings:

- `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`
- `GEMINI_MODEL=gemini-3.5-flash-lite`
- `GEMINI_MIN_REQUEST_INTERVAL_MS=15000`
- `GEMINI_MAX_REQUESTS_PER_CONTRACT=8`
- `GEMINI_MAX_WINDOWS_PER_BATCH=4`
- `GEMINI_MAX_BATCH_INPUT_CHARACTERS=18000`
- `GEMINI_MAX_BATCH_OUTPUT_TOKENS=6000`

## Real Upload Result

Fixture:

`raw/cuad/CUAD_v1/full_contract_pdf/Part_I/Affiliate_Agreements/TubeMediaCorp_20060310_8-K_EX-10.1_513921_EX-10.1_Affiliate Agreement.pdf`

Final run:

- Contract ID: `bc27463d-3668-4056-b974-0440cd74b129`
- Document ID: `8856dd1b-1197-444f-abfc-34c79c52947a`
- Processing run ID: `7530d096-a41e-41e3-b0e2-30a0b62bdc7e`
- Queue job ID: `contract-processing:8856dd1b-1197-444f-abfc-34c79c52947a`
- Job record ID: `eba012db-8ce3-49ed-855a-ca9d90011e73`
- Upload status: `STORED`
- Duplicate: `false`
- Checksum: `8a4eff8f8bcb90448999218e65ee08a5676a60d1df9e0a6f31631c5e1861f3b1`
- File size: `275856`

Processing states observed by polling:

- `PARSING`
- terminal detail state: `REVIEW_REQUIRED`

The terminal state is `REVIEW_REQUIRED` because the extractor produced review candidates. Confirmed candidates still persisted as active obligations.

## Extraction Metrics

Provider: `REFERENCE_AWARE_GEMINI`

Final metrics from the contract read model:

- Page count: 24
- Segment count: 71
- OCR page count: 0
- Raw candidates: 16
- Confirmed: 9
- Review required: 3
- Rejected: 4
- Duplicate removals: 0
- Consolidations: 0
- Gemini requests during extraction run: 8 total provider calls in logs, 6 extraction calls in metadata
- Retries: 0

Both required payment obligations persisted as separate active rows:

- `Network shall pay to Affiliate the Affiliate Advertising Share quarterly, no later than 45 days following the end of each calendar quarter.`
- `Network shall pay to Affiliate the Affiliate Transactional Share quarterly, no later than 45 days following the end of each calendar quarter.`

Both have:

- Responsible party: `The TUBE Music Network, Inc.`
- Counterparty: `Tribune Broadcasting Company`
- Category: `PAYMENT`
- Timing type: `RECURRING`
- Frequency: `quarterly`
- Offset: `45 days after`
- Review status: `CONFIRMED`

## Persistence

The final read model reported:

- Persisted active obligations: 9
- Status counts: `UPCOMING=9`, `DUE=0`, `MET=0`, `MISSED=0`
- Text pages: 24

Only confirmed candidates are mapped into `StructuredExtraction.obligations`; review-required and rejected candidates remain in extraction metadata and are not active obligations.

## PDF Streaming

Verified responses:

- Full PDF: `200 OK`, `Content-Type: application/pdf`, `Content-Length: 275856`, `Accept-Ranges: bytes`
- First-byte range: `206 Partial Content`, `Content-Range: bytes 0-99/275856`, `Content-Length: 100`
- Invalid range: `416 Range Not Satisfiable`, `Content-Range: bytes */275856`
- Missing document/contract: `404 Not Found`

## Source Anchors

Advertising Share anchors include page 22 action evidence and page 23 timing evidence. Transactional Share anchors include page 23 action and timing evidence. Page numbers remain separate from page-local lines; line numbers are not used as page numbers.

## Idempotency

Duplicate replay job:

- Job ID: `c646ad94-7710-49f5-bfde-3ee099d4a3a6`
- Replay payload reused the same contract/document/processing-run IDs.
- Worker log: `contract_processing_noop`, status `REVIEW_REQUIRED`, reason `ALREADY_TERMINAL`
- Job completed without rerunning extraction.
- Counts before replay: obligations `9`, text pages `24`

## Runtime Defects Fixed

- Root `dev:worker` script added.
- Contract read model now exposes extraction metrics.
- Obligation read model exposes party, category, timing, confidence, review status, and source anchors.
- PDF stream now handles invalid ranges with `416`.
- Audit read join casts `contract.id` to text for `audit_events.entity_id`.
- Gemini request budget is reset per extraction run, not per worker process.
- Reference-aware worker uses the same candidate-window detector configuration as the proven smoke script.
- Anchor persistence now retains `sourceEvidence` and source candidate keys.
- Obligation mapper accepts camelCase and legacy snake_case anchor fields.
- Transaction clients handle connection error events without crashing the process.

## Known Limitations

- Browser-controlled frontend upload/source-click verification was blocked because the in-app browser tool reported no available browser session.
- The real local backend/upload/worker/read-model/PDF flow was validated through API and logs, not by clicking through the browser UI.
- Final processing state is `REVIEW_REQUIRED`, not `COMPLETED`, because review candidates were produced. Confirmed obligations still persisted correctly.
