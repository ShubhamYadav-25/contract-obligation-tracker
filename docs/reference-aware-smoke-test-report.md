# Reference-Aware Gemini Smoke Test Report

Date: 2026-07-24

Final recommendation: NOT READY

The Gemini model-discovery issue is fixed and a real TubeMediaCorp non-persisting smoke run now completes under the configured request budget. The local app is still not ready because completed-result cache, checkpoint/resume, frontend upload, worker persistence, source navigation, and idempotency validation were not completed.

## Configuration

- `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini` was used for the successful smoke.
- `GEMINI_API_KEY` was loaded from ignored local `.env` and was not printed or saved.
- `GEMINI_MODEL=gemini-3.5-flash-lite` was selected from configuration.
- `GEMINI_MIN_REQUEST_INTERVAL_MS` default is now `15000`.
- `GEMINI_MAX_REQUESTS_PER_CONTRACT` default is `8`.
- Candidate batching defaults are `GEMINI_MAX_WINDOWS_PER_BATCH=4`, `GEMINI_MAX_BATCH_INPUT_CHARACTERS=18000`, and `GEMINI_MAX_BATCH_OUTPUT_TOKENS=6000`.

## Model Discovery

- SDK model metadata reads `supportedActions?: string[]` first.
- `generateContent` matching is case-insensitive.
- Missing or empty capability lists are treated as inconclusive, not unsupported.
- REST-style `supportedGenerationMethods` is inspected only through a guarded compatibility path.
- `models.list()` errors are propagated to the doctor instead of becoming an empty accessible-model list.
- Structured-output preflight remains the final model-usability check.

## Doctor Result

Command:

```powershell
corepack pnpm --filter @contract-obligation-tracker/api run gemini:doctor
```

Result:

- status: passed
- models returned: 41
- selected model: `gemini-3.5-flash-lite`
- selection source: `CONFIGURED_MODEL`
- structured output: passed
- sanitized artifact: `dev-output/reference-aware-working-app/gemini-doctor.json`

## Successful Smoke

Command:

```powershell
$env:OBLIGATION_EXTRACTOR_MODE='reference-aware-gemini'; corepack pnpm exec tsx src/scripts/run-reference-aware-extraction-smoke.ts --pdf "..\..\raw\cuad\CUAD_v1\full_contract_pdf\Part_I\Affiliate_Agreements\TubeMediaCorp_20060310_8-K_EX-10.1_513921_EX-10.1_Affiliate Agreement.pdf" --runs 1 --persist false --restart --out-dir "..\..\dev-output\reference-aware-working-app"
```

Artifact:

- `dev-output/reference-aware-working-app/reference-aware-smoke-1784864527229.json`

Metrics:

- pageCount: 24
- parsedPageCount: 24
- ocrPageCount: 0
- segmentCount: 71
- sourceLineCount: 667
- candidateWindowCount: 7
- candidateBatchCount: 5
- totalGeminiRequestCount: 8
- retryCount: 0
- rawCandidates: 25
- verifiedCandidates: 22
- confirmed: 12
- reviewRequired: 10
- rejected: 3
- duplicateRemovals: 0
- consolidations: 0
- source invariants: passed, 0 failures

## Payment Validation

- `Affiliate Advertising Share`: found, confirmed, with ACTION evidence on page 22 lines 600-601 and TIMING evidence on page 23 lines 630-631.
- `Affiliate Transactional Share`: found, confirmed, with ACTION evidence on page 23 lines 634-635 and TIMING evidence on page 23 lines 638-639.
- The two payment obligations remain separate.
- Sanitized artifact: `dev-output/reference-aware-working-app/payment-validation.json`

## Quota Controls

- Candidate extraction now batches candidate windows and returns window-keyed results.
- The smoke request plan is checked before LLM extraction and fails before spending quota if it exceeds budget.
- Gemini 429 parsing now classifies known quota categories and reads `Retry-After`, `RetryInfo`, and `QuotaFailure` details when provided.
- Daily quota failures fail fast; bounded retry and adaptive spacing handle retryable quota pressure.
- Sanitized artifacts:
  - `dev-output/reference-aware-working-app/quota-diagnostics.json`
  - `dev-output/reference-aware-working-app/request-plan.json`

## Remaining Gaps

- `--resume` and `--restart` flags are accepted, but actual checkpoint/resume behavior is not implemented.
- Completed-result cache is not implemented and no second cached run was executed.
- Persistence was not attempted because the successful smoke used `--persist false`.
- Frontend upload, worker queue, database persistence, PDF/source-anchor navigation, and idempotency were not verified.
