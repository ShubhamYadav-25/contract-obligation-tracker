# Reference-Aware Gemini Quota Optimization Report

Date: 2026-07-24

## Diagnosis

The previous blocker was Gemini HTTP 429 during `obligation_candidate_extraction`. The extractor was making one structured Gemini request per candidate window after model listing, model preflight, and contract-context extraction. For the TubeMediaCorp fixture, the pre-optimization plan was 10 Gemini calls: 1 model listing, 1 preflight, 1 context extraction, and 7 candidate-window requests.

## Implemented Controls

- Added Gemini quota error parsing with categories for requests per minute, tokens per minute, requests per day, concurrent requests, temporary capacity, and unknown quota.
- Added parsing for `Retry-After`, Google `RetryInfo`, and `QuotaFailure` payloads.
- Added daily quota fast-fail behavior.
- Added bounded quota retries and capped retry delays.
- Added adaptive request spacing; default `GEMINI_MIN_REQUEST_INTERVAL_MS` is now `15000`.
- Added per-contract Gemini request budget enforcement; default `GEMINI_MAX_REQUESTS_PER_CONTRACT` is `8`.
- Added candidate-window batching with window-keyed structured output.
- Added smoke request-plan generation before LLM extraction.

## Batch Plan

The successful TubeMediaCorp smoke planned 8 requests, exactly at the default request budget:

- model listing: 1
- model preflight: 1
- contract context extraction: 1
- candidate extraction: 5
- LLM consolidation: 0

Candidate windows: 7

Candidate batches: 5

Sanitized request plan: `dev-output/reference-aware-working-app/request-plan.json`

## Successful Real Smoke

Artifact: `dev-output/reference-aware-working-app/reference-aware-smoke-1784864527229.json`

Result:

- model: `gemini-3.5-flash-lite`
- total Gemini requests: 8
- retry count: 0
- raw candidates: 25
- verified candidates: 22
- confirmed obligations: 12
- review-required obligations: 10
- rejected candidates: 3
- source invariant failures: 0
- `Affiliate Advertising Share`: found and confirmed
- `Affiliate Transactional Share`: found and confirmed
- payment obligations remain separate: true

## Not Implemented

- Durable context checkpoint/resume.
- Durable batch checkpoint/resume.
- Completed-result cache.
- Second cached run proving Gemini-free replay.
- Persistence/idempotency comparison.
- Frontend upload and PDF/source-navigation validation.

This is a working non-persisting smoke path, not a validated working local app.
