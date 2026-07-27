# Obligation Extraction Integration Plan

Status: proposed plan only. This plan does not replace parsing, OCR, storage, persistence, scheduler, job queue, or state-machine services.

## Current Flow

```text
PDF upload
  -> ContractIngestionService validates and stores the PDF
  -> ContractProcessingProducer enqueues PROCESS_CONTRACT
  -> JobRunner claims the job
  -> ContractProcessingProcessor.process(...)
  -> ContractProcessingOrchestrator.processContract(...)
  -> DocumentTextProcessingPipeline.run(...)
  -> StorageProvider.download(...)
  -> DocumentTextExtractor.extract(...)
  -> OCR fallback for low-quality pages only
  -> segmentDocumentPages(...)
  -> ObligationExtractionProvider.extract(...)
       -> OBLIGATION_EXTRACTOR_MODE=auto uses Groq when GROQ_API_KEY is set, otherwise heuristic
       -> OBLIGATION_EXTRACTOR_MODE=heuristic uses HeuristicObligationExtractionProvider
       -> OBLIGATION_EXTRACTOR_MODE=groq uses GroqObligationExtractionProvider and requires GROQ_API_KEY
       -> OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini uses ReferenceAwareObligationExtractor and requires GEMINI_API_KEY plus GEMINI_MODEL; when GROQ_API_KEY is present, Gemini quota exhaustion triggers Groq
       -> extractFieldsFromPages(...) for heuristic extraction
  -> toExtractedObligations(...)
  -> PostgresDocumentTextPageRepository.replacePages(...)
  -> PostgresObligationRepository.upsertExtractedForContract(...)
  -> ContractProcessingRepository.markTextSegmented(...)
  -> audit events
```

## Proposed Flow

```text
PDF upload
  -> existing validation and storage unchanged
  -> existing PROCESS_CONTRACT job unchanged
  -> existing processor and orchestrator unchanged
  -> existing DocumentTextProcessingPipeline.run(...)
  -> existing PDF parsing unchanged
  -> existing OCR fallback unchanged
  -> existing segmentDocumentPages(...) unchanged
  -> feature-flagged ObligationExtractionProvider.extract(...)
       -> ReferenceAwareObligationExtractor only when explicitly selected
       -> explicit EXTRACTION-stage failure on reference-aware extraction failure
       -> explicit reference-aware-gemini mode falls back to Groq only for quota/request-budget exhaustion when GROQ_API_KEY is configured; other Gemini failures remain visible
  -> existing toExtractedObligations(...) mapping for confirmed obligations only
  -> existing text-page persistence unchanged
  -> existing obligation repository unchanged
  -> existing processing run and audit behavior unchanged
```

## Non-Goals

- Do not replace `NativePdfTextExtractorAdapter`.
- Do not replace `PdfJsPageRendererAdapter`.
- Do not replace Tesseract or Gemini Vision OCR adapters.
- Do not alter permanent storage providers.
- Do not change database schemas or migrations.
- Do not replace `PostgresDocumentTextPageRepository`.
- Do not replace `PostgresObligationRepository`.
- Do not replace `JobRepository`, `JobRunner`, `JobPoller`, or scheduler services.
- Do not alter contract processing state-machine status values.
- Do not remove `extractFieldsFromPages(...)` or `HeuristicObligationExtractionProvider`.

## Integration Boundary

Use `ObligationExtractionProvider` from `apps/api/src/modules/extraction/obligation-extraction.provider.ts` as the integration boundary.

Minimum future changes should be:

1. Add a new provider class in the extraction module.
2. Add typed configuration in `apps/api/src/config/env.ts`.
3. Select the provider in `apps/api/src/bootstrap/register-workers.ts`.
4. Keep the selected provider injected through `DocumentTextProcessingPipelineDependencies.obligationExtractor`.

If richer references are required, widen `ObligationExtractionInput` additively. Prefer a DTO that preserves:

- `pageNumber`
- `rawText`
- `normalizedText`
- page-local `lines`
- `segments`
- `extractionMethod`
- optional `ocrConfidence`

Keep `Page = { pageNumber; rawText }` compatibility for the heuristic provider or add an adapter from richer pages to heuristic pages.

## Feature Flag Plan

Provider selection is implemented in `apps/api/src/config/env.ts` and composed in `apps/api/src/bootstrap/register-workers.ts`.

Current shape:

```text
OBLIGATION_EXTRACTOR_MODE=auto|heuristic|groq|reference-aware-gemini
```

Rules:

- Default `auto` preserves pre-integration behavior: use Groq when `GROQ_API_KEY` exists, otherwise heuristic.
- `heuristic` remains available and always selects `HeuristicObligationExtractionProvider`.
- `groq` requires `GROQ_API_KEY` and selects `GroqObligationExtractionProvider`.
- `reference-aware-gemini` requires `GEMINI_API_KEY` and `GEMINI_MODEL`. With
  `GROQ_API_KEY`, quota or per-contract request-budget exhaustion activates Groq;
  Groq retains the existing heuristic fallback.
- Reference-aware extraction failures must not silently fall back to Groq or heuristic extraction.
- Transient reference-aware failures use existing retryable processing semantics.
- Permanent reference-aware failures fail the `EXTRACTION` stage explicitly.
- Any future fallback behavior must be an explicit configuration mode, and must be recorded in logs and extraction metadata.
- Logs should include provider name, contract ID, document ID, processing run ID, source page count, prompt/reference count, extracted count, dropped/unverified count, and any explicitly configured fallback reason.

## Type Contract Plan

Current input:

```ts
type ObligationExtractionInput = {
  readonly pages: readonly Page[];
  readonly context: ObligationExtractionContext;
};
```

Recommended additive input:

```ts
type ObligationExtractionPage = {
  readonly pageNumber: number;
  readonly rawText: string;
  readonly normalizedText?: string;
  readonly lines?: readonly ParsedDocumentLine[];
  readonly segments?: readonly DocumentTextSegment[];
  readonly extractionMethod?: DocumentTextExtractionMethod;
  readonly ocrConfidence?: number;
};
```

Then change `ObligationExtractionInput.pages` to `readonly ObligationExtractionPage[]`, while keeping `HeuristicObligationExtractionProvider` mapped to `{ pageNumber, rawText }`.

Current output can remain:

```ts
type ObligationExtractionResult = {
  readonly extraction: StructuredExtraction;
  readonly confidence: number;
  readonly provider: "HEURISTIC" | "GROQ" | "REFERENCE_AWARE_GEMINI";
  readonly metadata?: ObligationExtractionMetadata;
};
```

## Source Reference Rules

- Treat all line numbers as page-local.
- Page-local line numbers are one-based and restart from 1 on every page.
- Use one-based `start_line` and `end_line` for explicit anchors.
- Use zero-based `line_offset` for backward-compatible anchor positioning.
- Use page-local `start_offset` and `end_offset`.
- Require `quoted_text` to be a verbatim substring of page or segment text.
- Preserve `source` values so downstream audit/debugging can distinguish `heuristic_obligation`, `groq_obligation`, and any future reference-aware source.

## Tests To Add Or Update Later

Add focused unit tests rather than broad integration tests first:

- Provider selection in `apps/api/tests/unit/register-workers.test.ts` or a new composition test.
- Env parsing in `apps/api/tests/unit/env.test.ts`.
- Pipeline passes reference-rich page data to the provider in `apps/api/tests/unit/document-text-processing.pipeline.test.ts`.
- New provider validates page-local line anchors and offsets.
- New provider marks transient failures retryable and permanent failures explicit at the `EXTRACTION` stage.
- Any fallback tests should cover only an explicit configured fallback mode, not silent Groq or heuristic fallback.
- Mapping test confirms `toExtractedObligations(...)` still produces `ExtractedObligationInput` compatible with `PostgresObligationRepository`.

Run documented commands after implementation:

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`
- `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`

## Files Expected To Change In A Future Implementation

Likely:

- `apps/api/src/modules/extraction/obligation-extraction.provider.ts`
- `apps/api/src/bootstrap/register-workers.ts`
- `apps/api/src/config/env.ts`
- `apps/api/tests/unit/document-text-processing.pipeline.test.ts`
- `apps/api/tests/unit/register-workers.test.ts`
- `apps/api/tests/unit/env.test.ts`
- `.env.example`

Possible:

- `apps/api/src/modules/contracts/document-text-processing.pipeline.ts`
- `apps/api/src/modules/extraction/index.ts`
- New provider-specific test file under `apps/api/tests/unit/`

Do not change for provider-only integration:

- `packages/database/migrations/*`
- `apps/api/src/infrastructure/pdf/*`
- `apps/api/src/infrastructure/ocr/*`
- `apps/api/src/infrastructure/storage/*`
- `apps/api/src/jobs/*`
- `apps/api/src/modules/contracts/contracts.state-machine.ts`
- `apps/api/src/modules/contracts/postgres-contract.repository.ts`
- `apps/api/src/modules/obligations/postgres-obligation.repository.ts`
