# Reference-Aware Working App Report

Date: 2026-07-24

Final readiness: NOT READY

The reference-aware Gemini extractor now completes a real non-persisting TubeMediaCorp smoke run and confirms both payment-share obligations. The local application flow is not fully validated because upload, worker processing, persistence, idempotency, source-anchor navigation, checkpoint/resume, and completed-result cache were not completed.

## Completed

- Gemini model discovery and selection are fixed.
- Real Gemini doctor passes with `gemini-3.5-flash-lite`.
- Gemini calls now redact configured key material from error metadata.
- Candidate extraction now batches windows and verifies returned `windowId` values.
- Smoke request planning prevents known over-budget runs before LLM extraction.
- Gemini 429 handling now includes quota classification, retry-delay parsing, bounded retries, daily-quota fast fail, and adaptive request spacing.
- Unsupported model-added cross references are dropped when they are absent from the window text and unresolved in contract context.
- Payment candidates with timing-only model evidence receive deterministic ACTION evidence repair only when a same-window source line supports the pay action.
- Source verification remains strict; out-of-window evidence and missing/unknown batch window results are rejected.

## Real Smoke Result

Command:

```powershell
$env:OBLIGATION_EXTRACTOR_MODE='reference-aware-gemini'; corepack pnpm exec tsx src/scripts/run-reference-aware-extraction-smoke.ts --pdf "..\..\raw\cuad\CUAD_v1\full_contract_pdf\Part_I\Affiliate_Agreements\TubeMediaCorp_20060310_8-K_EX-10.1_513921_EX-10.1_Affiliate Agreement.pdf" --runs 1 --persist false --restart --out-dir "..\..\dev-output\reference-aware-working-app"
```

Artifact:

- `dev-output/reference-aware-working-app/reference-aware-smoke-1784864527229.json`

Metrics:

- pageCount: 24
- requiredPaymentTermsPresent: true
- ocrPageCount: 0
- candidateWindowCount: 7
- candidateBatchCount: 5
- totalGeminiRequestCount: 8
- retryCount: 0
- rawCandidates: 25
- verifiedCandidates: 22
- confirmed: 12
- reviewRequired: 10
- rejected: 3
- source invariants: passed

## Payment Obligations

- `Affiliate Advertising Share`: confirmed; ACTION evidence page 22 lines 600-601, TIMING evidence page 23 lines 630-631.
- `Affiliate Transactional Share`: confirmed; ACTION evidence page 23 lines 634-635, TIMING evidence page 23 lines 638-639.
- The obligations remain separate.

## Not Ready Items

- Completed-result cache was not implemented.
- The second cached run was not executed.
- Checkpoint/resume flags are parsed, but functional checkpoint/resume is not implemented.
- Persistence was not attempted.
- Frontend upload flow was not run.
- Worker queue processing was not validated through the app.
- Database idempotency was not compared.
- PDF/source-anchor navigation was not verified.

## Sanitized Artifacts

- `dev-output/reference-aware-working-app/gemini-doctor.json`
- `dev-output/reference-aware-working-app/quota-diagnostics.json`
- `dev-output/reference-aware-working-app/request-plan.json`
- `dev-output/reference-aware-working-app/context-checkpoint.json`
- `dev-output/reference-aware-working-app/batch-checkpoint-summary.json`
- `dev-output/reference-aware-working-app/extraction-run-1.json`
- `dev-output/reference-aware-working-app/extraction-run-2-cache-hit.json`
- `dev-output/reference-aware-working-app/normalized-run-comparison.json`
- `dev-output/reference-aware-working-app/payment-validation.json`
- `dev-output/reference-aware-working-app/app-flow-validation.json`

## Final Application Integration Update

Date: 2026-07-24

Final readiness: NOT READY

The backend upload-to-worker-to-read-model path is now validated with the exact TubeMediaCorp PDF. The frontend server loads, but browser-controlled upload/source-click validation could not be completed because the in-app browser tool reported no available browser session.

Validated local run:

- Contract ID: `bc27463d-3668-4056-b974-0440cd74b129`
- Document ID: `8856dd1b-1197-444f-abfc-34c79c52947a`
- Processing run ID: `7530d096-a41e-41e3-b0e2-30a0b62bdc7e`
- Provider: `REFERENCE_AWARE_GEMINI`
- Processing terminal state: `REVIEW_REQUIRED`
- Page count: 24
- Segment count: 71
- OCR page count: 0
- Raw candidates: 16
- Confirmed active obligations: 9
- Review required candidates: 3
- Rejected candidates: 4
- Retries: 0

Payment obligation validation:

- `Affiliate Advertising Share` persisted as a confirmed payment obligation with page 22 action evidence and page 23 timing evidence.
- `Affiliate Transactional Share` persisted as a separate confirmed payment obligation with page 23 action and timing evidence.
- Both rows expose responsible party, counterparty, category, recurrence, 45-day offset, confidence, review status, and source anchors.

Additional validated behavior:

- PDF full stream: `200 OK`.
- PDF first-byte range: `206 Partial Content`.
- Invalid range: `416 Range Not Satisfiable`.
- Missing contract/document: `404 Not Found`.
- Duplicate job replay: `contract_processing_noop`, reason `ALREADY_TERMINAL`.

See `docs/final-application-wiring-report.md` for the full handoff details.
