# Obligation Extraction Integration Progress

Status: internal reference-aware domain schemas, deterministic source utilities, deterministic candidate-window detection, provider-neutral structured LLM interfaces, a Gemini structured LLM client, contract-level context extraction, relevant context selection, window-level obligation candidate extraction, source verification, deduplication, consolidation, review gating, and feature-flagged reference-aware pipeline integration have been added.

No database schema, scheduler, state-machine, OCR, parsing, storage, or obligation persistence repository changes were made. The reference-aware extractor is inactive by default and is selected only when `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`. The default extractor mode is `auto`, which preserves the prior runtime behavior: use Groq when `GROQ_API_KEY` is configured, otherwise use the heuristic provider.

## Verified Runtime Pipeline

The active processing entry point is the background worker runtime in `apps/api/src/bootstrap/register-workers.ts`.

Runtime flow:

1. `createWorkerRuntime(...)` wires `PROCESS_CONTRACT` to `ContractProcessingProcessor` from `apps/api/src/jobs/processors/contract-processing.processor.ts`.
2. `ContractProcessingProcessor.process(...)` validates `BackgroundJob.payload` with `processContractJobPayloadSchema` from `apps/api/src/modules/contracts/contract-processing-job.schema.ts`, then calls `ContractProcessingOrchestrator.processContract(...)`.
3. `ContractProcessingOrchestrator.processContract(...)` in `apps/api/src/modules/contracts/contract-processing-orchestrator.service.ts` claims the run, audits start/failure/completion, and calls `ContractProcessingPipeline.run(...)`.
4. The concrete pipeline is `DocumentTextProcessingPipeline` from `apps/api/src/modules/contracts/document-text-processing.pipeline.ts`.
5. `DocumentTextProcessingPipeline.run(...)` downloads the stored PDF, marks `PARSING`, calls `DocumentTextExtractor.extract(...)`, runs OCR only for unusable pages, segments pages, calls `ObligationExtractionProvider.extract(...)`, maps extracted obligations, persists text pages and obligations in one transaction, marks `TEXT_SEGMENTED`, and appends audit events.

The earlier assumption `apps/api/src/modules/contracts/document-text-processing.pipeline.ts` is correct. `apps/api/src/modules/extraction/heuristics.ts` and `apps/api/src/modules/obligations/postgres-obligation.repository.ts` are still relevant, but the active worker does not call `extractFieldsFromPages(...)` directly.

## Exact Integration Boundary

The safest boundary for a reference-aware extractor is:

- Interface: `ObligationExtractionProvider` in `apps/api/src/modules/extraction/obligation-extraction.provider.ts`.
- Method: `extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult>`.
- Injection point: `DocumentTextProcessingPipelineDependencies.obligationExtractor` in `apps/api/src/modules/contracts/document-text-processing.pipeline.ts`.
- Runtime composition point: `createWorkerRuntime(...)` in `apps/api/src/bootstrap/register-workers.ts`.

`DocumentTextProcessingPipeline.run(...)` now passes the legacy extractor pages plus the already-created segmented pages into the provider boundary:

```ts
{
  pages: extractionPages,
  segmentedPages,
  context: input,
}
```

The existing heuristic extractor ignores the optional `segmentedPages` field, so old extraction behavior remains available. The reference-aware extractor uses this richer input to build `ContractSourceIndex` without replacing parsing, OCR, storage, persistence, scheduler, job queue, or state-machine services.

Reference-aware extraction failures do not silently fall back to Groq or heuristic extraction. `DocumentTextProcessingPipeline.run(...)` wraps extraction failures as `OBLIGATION_EXTRACTION_FAILED` at stage `EXTRACTION`, using existing retryable/permanent processing semantics based on the sanitized provider error.

## Page Text And Segment Types

Verified exported types in `apps/api/src/modules/document-processing/document-processing.types.ts`:

- `DocumentExtractionInput`
- `DocumentPageRenderInput`
- `RenderedDocumentPage`
- `DocumentTextExtractionMethod`
- `DocumentPageDimensions`
- `ParsedDocumentTextItem`
- `ParsedDocumentLine`
- `ParsedDocumentPage`
- `ParsedDocument`
- `DocumentTextSegment`
- `SegmentedDocumentPage`
- `DocumentTextExtractor`
- `PdfPageRenderer`

Important shapes:

- `ParsedDocumentPage` contains `documentId`, `pageNumber`, `text`, `lines`, `rawText`, `normalizedText`, `textItems`, optional `dimensions`, text quality metrics, `extractionMethod`, optional `ocrConfidence`, and `warnings`.
- `DocumentTextSegment` contains `documentId`, `pageNumber`, `lineStart`, `lineEnd`, `text`, `normalizedText`, `startOffset`, `endOffset`, `extractionMethod`, and optional `boundingBox`.
- `SegmentedDocumentPage extends ParsedDocumentPage` with `segments`.
- `PersistDocumentTextPageInput` in `apps/api/src/modules/contracts/contracts.repository.ts` mirrors the persisted page record and stores `segments` as `readonly Record<string, unknown>[]`.
- `DocumentTextPageRecord` in `apps/api/src/modules/contracts/contracts.types.ts` is the read model returned by `PostgresDocumentTextPageRepository.listByContract(...)`.

## Line Numbers And Offsets

Line numbers are page-local, not global.

- `splitPageLines(pageNumber, text)` in `apps/api/src/modules/document-processing/text-normalizer.ts` assigns `lineNumber: index + 1` for each non-empty line on that page.
- `segmentPageText(...)` in `apps/api/src/modules/document-processing/text-segmentation.ts` recomputes page-local source lines and assigns `lineStart` and `lineEnd` from those page-local line numbers.
- `extractFieldsFromPages(...)` in `apps/api/src/modules/extraction/heuristics.ts` creates `Anchor.line_offset` as a zero-based page-local line offset.
- `GroqObligationExtractionProvider` converts source text to page-local numbered lines, asks for `lineStart` and `lineEnd`, and converts `lineStart` to zero-based `line_offset`.

There is no verified global line-number model. `startOffset` and `endOffset` are page-local character offsets into the page text used by the extractor or segmenter.

Reference-aware source references keep the same page-local decision: `SourceLineRange`, `EvidenceSpanCandidate`, and `VerifiedEvidenceSpan` require `pageNumber`, `startLine`, and `endLine`; cross-page evidence is represented as multiple single-page ranges.

## OCR Page Representation

OCR is page-level replacement, not a separate page collection.

- `DocumentTextExtractionMethod` is `"PDF_TEXT" | "TESSERACT" | "GEMINI_VISION"`.
- `DocumentTextProcessingPipeline.ocrPages(...)` builds a `Map<number, ParsedDocumentPage>` for pages needing OCR and returns the original page array with only those pages replaced.
- `pageFromOcrResult(...)` converts `OcrResult` to `ParsedDocumentPage` by setting:
  - `text` and `normalizedText` from OCR output,
  - `lines` from `splitPageLines(basePage.pageNumber, normalizedText)`,
  - `rawText` from `result.text`,
  - `textItems` to one whole-page text item when text exists,
  - `extractionMethod` to `result.provider`,
  - `ocrConfidence` to `result.confidence`,
  - `warnings` to quality warnings plus OCR warnings.
- `PostgresDocumentTextPageRepository.replacePages(...)` persists OCR pages in `document_text_pages.extraction_method` and `ocr_confidence`.
- OCR page count is computed as pages where `extractionMethod !== "PDF_TEXT"`.

OCR provider contracts are `OcrInput`, `OcrResult`, and `OcrProvider` in `apps/api/src/infrastructure/ocr/ocr-provider.ts`.

## extractFieldsFromPages Invocations

Runtime-relevant invocation:

- `HeuristicObligationExtractionProvider.extract(...)` in `apps/api/src/modules/extraction/obligation-extraction.provider.ts` calls `extractFieldsFromPages([...input.pages])`.

Older/adjacent invocation:

- `DeterministicExtractor.run(...)` in `apps/api/src/modules/extraction/deterministic-extractor.ts` calls `extractFieldsFromPages(pages)` and writes extraction candidates. This class was inspected but is not wired into `createWorkerRuntime(...)`.

Tests:

- `apps/api/tests/unit/heuristics.test.ts`
- `apps/api/tests/unit/groq-obligation-extractor.test.ts`
- `apps/api/tests/unit/document-text-processing.pipeline.test.ts`

## Current Extractor Contracts

In `apps/api/src/modules/extraction/heuristics.ts`:

- `Page = { pageNumber: number; rawText: string }`
- `Anchor`
- `FieldAnchor`
- `StructuredExtraction`
- `extractFieldsFromPages(pages: Page[]): { extraction: StructuredExtraction; confidence: number }`

In `apps/api/src/modules/extraction/obligation-extraction.provider.ts`:

- `ObligationExtractionContext`
- `ObligationExtractionInput`
- `ObligationExtractionResult`
- `ObligationExtractionMetrics`
- `ObligationExtractionMetadata`
- `ObligationExtractionReviewCandidate`
- `ObligationExtractionProvider`
- `HeuristicObligationExtractionProvider`
- `GroqObligationExtractionConfig`
- `GroqObligationExtractionProvider`

Current provider output is:

```ts
{
  extraction: StructuredExtraction;
  confidence: number;
  provider: "HEURISTIC" | "GROQ" | "REFERENCE_AWARE_GEMINI";
  metadata?: ObligationExtractionMetadata;
}
```

`ObligationExtractionInput` remains backward-compatible with the legacy `pages` array and now carries optional `segmentedPages` for the reference-aware provider.

## Mapping And Persistence

Mapping happens inside `apps/api/src/modules/contracts/document-text-processing.pipeline.ts`:

- `toExtractedObligations(...)` maps `FieldAnchor[]` to `ExtractedObligationInput[]`.
- `normalizeObligationText(...)` normalizes title and description text.
- `toObligationTitle(...)` truncates generated titles to 180 characters.
- `parseAnchorDueDate(...)` and `parseExplicitDueDate(...)` derive `dueAt`.
- `toAnchorRecord(...)` maps heuristic/Groq `Anchor` data into a JSON-safe anchor record and synthesizes normalized source boxes from line offsets.

Persistence contracts:

- `ExtractedObligationInput` and `ObligationRepository.upsertExtractedForContract(...)` in `apps/api/src/modules/obligations/obligations.repository.ts`.
- `PostgresObligationRepository.upsertExtractedForContract(...)` in `apps/api/src/modules/obligations/postgres-obligation.repository.ts`.

Persistence behavior:

- Upsert key is `(contract_id, title)` by selecting the earliest existing matching title.
- Existing rows update `description`, `anchors`, `updated_at`, and only replace `due_at` when the new value is non-null.
- New rows insert `contract_id`, `title`, `description`, `due_at`, and `anchors`.
- `anchors` are stored as JSONB in `obligations.anchors`.

Text page persistence:

- `PostgresDocumentTextPageRepository.replacePages(...)` deletes existing pages for `document_id`, then inserts/upserts `document_text_pages` by `(document_id, page_number)`.
- Page records include OCR method/confidence and segments JSONB.

## Existing Utilities To Reuse

Retry and failure handling:

- `RetryableContractProcessingError`, `PermanentContractProcessingError`, and `toProcessingFailure(...)` in `apps/api/src/modules/contracts/contract-processing.errors.ts`.
- `PermanentJobError`, `RetryableJobError`, `isRetryableJobError(...)`, `getRetryDelayMilliseconds(...)`, and `getErrorMessage(...)` in `apps/api/src/jobs/retry-policy.ts`.
- Groq-specific retry helpers are local to `apps/api/src/modules/extraction/obligation-extraction.provider.ts`: `isRetryableError(...)`, `delay(...)`, and `toRetryDelay(...)`.

Logging:

- `Logger` and `createLogger(...)` in `apps/api/src/config/logger.ts`.
- Existing structured events include `groq_obligation_prompt_compacted`, `groq_obligations_extracted`, `groq_obligation_extraction_failed`, and `groq_obligation_extraction_fell_back_to_heuristics`.

Configuration:

- `envSchema`, `ApiEnv`, `parseEnv(...)`, and `loadEnv(...)` in `apps/api/src/config/env.ts`.
- Current extraction env: `GROQ_API_KEY`, `GROQ_EXTRACTION_MODEL`, `GROQ_EXTRACTION_TEMPERATURE`, `GROQ_EXTRACTION_MAX_TOKENS`, `GROQ_EXTRACTION_TIMEOUT_MS`, `GROQ_EXTRACTION_MAX_ATTEMPTS`, `GROQ_EXTRACTION_RETRY_BASE_DELAY_MS`, `GROQ_EXTRACTION_RETRY_MAX_DELAY_MS`.
- Reference-aware extractor flag: `OBLIGATION_EXTRACTOR_MODE`, with values `auto`, `heuristic`, `groq`, and `reference-aware-gemini`; default is `auto`.
- Document/OCR env: `DOCUMENT_TEXT_*`, `DOCUMENT_SEGMENT_*`, `OCR_*`, `GEMINI_OCR_FALLBACK_ENABLED`.

Job queue:

- `JobRepository` and `PostgresJobRepository` in `apps/api/src/jobs/job.repository.ts`.
- `JobRunner` in `apps/api/src/jobs/job-runner.ts`.
- `JobPoller` and `PollingLoop` in `apps/api/src/jobs/pollers/`.
- `ProcessorRegistry` in `apps/api/src/jobs/processors/processor-registry.ts`.
- `ContractProcessingProducer` in `apps/api/src/jobs/producers/contract-processing.producer.ts`.
- `createJobConfig(...)` in `apps/api/src/config/jobs.ts`.

LLM structured output:

- `LlmProvider`, `LlmStructuredRequest`, and `LlmStructuredResponse` in `apps/api/src/infrastructure/llm/llm-provider.ts`.
- `GroqLlmAdapter` in `apps/api/src/infrastructure/llm/groq.adapter.ts`.
- `parseStructuredResponse(...)` in `apps/api/src/infrastructure/llm/structured-response-parser.ts`.
- Zod validation pattern in `apps/api/src/modules/extraction/obligation-extraction.provider.ts`.
- New provider-neutral structured LLM interface in `apps/api/src/infrastructure/llm/structured-llm-client.ts`.
- New offline test double in `apps/api/src/infrastructure/llm/fake-structured-llm-client.ts`.
- New Gemini-specific structured client in `apps/api/src/infrastructure/llm/gemini-structured-llm.client.ts`.

Transactions and audit:

- `TransactionManager` and `TransactionContext` in `apps/api/src/infrastructure/database/transaction-manager.ts`.
- `AuditRepository` and `PostgresAuditRepository` in `apps/api/src/modules/audit/`.

## Test Framework And Fixtures

Framework:

- Vitest is used by API scripts: `test`, `test:unit`, `test:integration`, and `test:kpi` in `apps/api/package.json`.
- Root scripts use `corepack pnpm` wrappers in `package.json`.
- Supertest is present in API dev dependencies and used for route tests.

Relevant tests:

- `apps/api/tests/unit/document-text-processing.pipeline.test.ts`
- `apps/api/tests/unit/groq-obligation-extractor.test.ts`
- `apps/api/tests/unit/heuristics.test.ts`
- `apps/api/tests/unit/text-segmentation.test.ts`
- `apps/api/tests/unit/contract-processing.processor.test.ts`
- `apps/api/tests/unit/register-workers.test.ts`
- `apps/api/tests/integration/contract-processing-repository.integration.test.ts`
- `apps/api/tests/integration/job-repository.integration.test.ts`

Fixtures and helpers:

- `packages/test-kit/src/fixture-loader.ts` resolves fixtures under `datasets`.
- `packages/test-kit/src/mock-providers.ts` defines generic provider mock shapes, but the API extraction tests mostly use local Vitest fakes.
- `working-subset/contracts/*.pdf` and `working-subset/manifest.json` exist for CUAD-style sample PDFs.
- `datasets/*` contains JSONL scenario datasets and README files.

## Module Format And Node Version

- Root `package.json`: `"type": "module"`, `packageManager: "pnpm@10.14.0"`, engines `node >=22.0.0`, `pnpm >=10.0.0`.
- API `apps/api/package.json`: `"type": "module"`.
- `tsconfig.base.json`: `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `strict: true`, `exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true`.

The API package is ESM.

## Safest Feature-Flag Insertion Point

Use runtime composition in `apps/api/src/bootstrap/register-workers.ts`, backed by typed env parsing in `apps/api/src/config/env.ts`.

Implemented shape:

- `OBLIGATION_EXTRACTOR_MODE` was added to `envSchema`.
- `auto` remains the default and selects `GroqObligationExtractionProvider` when `GROQ_API_KEY` is configured, otherwise `HeuristicObligationExtractionProvider`.
- `ReferenceAwareObligationExtractor` is selected only when `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`.
- No fallback from reference-aware Gemini to heuristic or Groq is implemented.
- Provider selection happens in `createObligationExtractor(...)`, called by `createWorkerRuntime(...)`.
- The selected implementation is still passed into `DocumentTextProcessingPipeline` as `obligationExtractor`.

This isolates the feature flag from parsing, OCR, storage, persistence, scheduler, job queue, and state-machine code.

## Code Affected By Replacing Only Extraction Implementation

Runtime files likely affected:

- `apps/api/src/modules/extraction/obligation-extraction.provider.ts`
- `apps/api/src/modules/extraction/reference-aware/reference-aware-extraction.schemas.ts`
- `apps/api/src/modules/extraction/reference-aware/index.ts`
- `apps/api/src/bootstrap/register-workers.ts`
- `apps/api/src/config/env.ts`
- `.env.example` if a new env flag or provider config is added in a future task

Potentially affected if the provider input is widened for references/segments:

- `apps/api/src/modules/contracts/document-text-processing.pipeline.ts`
- `apps/api/src/modules/extraction/heuristics.ts` only for shared types or fallback compatibility, not removal
- `apps/api/src/modules/extraction/index.ts`

Tests likely affected:

- `apps/api/tests/unit/document-text-processing.pipeline.test.ts`
- `apps/api/tests/unit/groq-obligation-extractor.test.ts`
- `apps/api/tests/unit/heuristics.test.ts`
- `apps/api/tests/unit/register-workers.test.ts`
- `apps/api/tests/unit/env.test.ts`
- `apps/api/tests/unit/reference-aware-extraction.schemas.test.ts`

Adjacent/legacy code to inspect before deleting or rewiring anything:

- `apps/api/src/modules/extraction/deterministic-extractor.ts`
- `apps/api/src/modules/extraction/prompt-builder.ts`
- `apps/api/src/modules/extraction/extraction.service.ts`
- `apps/api/src/modules/extraction/extraction.schemas.ts`
- `apps/api/src/modules/extraction/postgres-extraction.repository.ts`

Files that should not be replaced for this integration:

- `apps/api/src/infrastructure/pdf/native-pdf-text-extractor.adapter.ts`
- `apps/api/src/infrastructure/pdf/pdfjs-page-renderer.adapter.ts`
- `apps/api/src/infrastructure/ocr/*`
- `apps/api/src/infrastructure/storage/*`
- `apps/api/src/modules/contracts/postgres-contract.repository.ts`
- `apps/api/src/modules/obligations/postgres-obligation.repository.ts`
- `apps/api/src/jobs/*`
- `apps/api/src/modules/contracts/contracts.state-machine.ts`
- `packages/database/migrations/*`

## Commands Run During Inspection

- `git status --short`
- `rg --files`
- Multiple `rg` and `Get-Content` read-only inspections of API source, tests, package metadata, and migrations.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`
- `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`

Documented commands available but not run:

- `corepack pnpm -r --if-present run typecheck`
- `corepack pnpm -r --if-present run test`
- `corepack pnpm -r --if-present run lint`
- `corepack pnpm format:check`

## Existing Failures Or Notable Findings

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck` passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot` passed after the reference-aware integration task: 37 test files and 184 tests.
- `corepack pnpm -r --if-present run lint` passed; no package-specific lint tasks emitted output.
- Passing unit tests emitted expected API error logs to stderr for negative route cases: unauthenticated upload, oversized upload, and not-found error response.
- `docs/architecture/backend-wiring.md` and `docs/modules/contract-ingestion.md` referenced by prior memory are not present in this checkout.
- `Get-ChildItem -Path docs -Recurse -File` timed out during inspection, and direct reads of the two older doc paths failed because those paths do not exist.
- `DeterministicExtractor.run(...)` has a direct SQL insert into `obligations` and a nested repository transaction pattern; it appears separate from the active worker runtime and should not be used as the integration model without further cleanup.
- `DocumentTextProcessingPipeline.run(...)` currently discards `segments`, `lines`, `normalizedText`, `extractionMethod`, and `ocrConfidence` before calling the obligation extractor.
- Provider names are currently a literal union `"HEURISTIC" | "GROQ"`.

## Internal Reference-Aware Schema Progress

Schema file location chosen:

- `apps/api/src/modules/extraction/reference-aware/reference-aware-extraction.schemas.ts`
- `apps/api/src/modules/extraction/reference-aware/index.ts`

The existing `apps/api/src/modules/extraction/extraction.schemas.ts` was not used as the host because it belongs to an older or separate extraction-candidate workflow and includes model-facing `quotedText` in source anchors. The reference-aware raw model evidence contract intentionally rejects quotes, offsets, bounding boxes, calculated page ranges, and database identifiers.

Existing schemas and components reused:

- Zod is reused for all runtime schemas and inferred TypeScript types.
- Existing page-local line-number semantics from `text-normalizer.ts`, `text-segmentation.ts`, `heuristics.ts`, and `GroqObligationExtractionProvider` are preserved.
- Existing `DocumentTextExtractionMethod` values are mirrored for `candidateWindowSourceMethodSchema`: `PDF_TEXT`, `TESSERACT`, and `GEMINI_VISION`.
- Existing LLM structured response components remain available for later implementation but were not integrated in this task.

Duplicated concepts intentionally avoided:

- No new active provider union was added.
- No database IDs, contract IDs, processing-run IDs, obligation state, calculated due dates, reminder times, character offsets, or bounding boxes were added to raw model-facing evidence.
- Existing `extraction.schemas.ts` remains unchanged for the older candidate workflow.

Exported schemas and inferred types:

- `obligationBusinessTypeSchema` / `ObligationBusinessType`
- `obligationTimingTypeSchema` / `ObligationTimingType`
- `evidenceRoleSchema` / `EvidenceRole`
- `partyResolutionMethodSchema` / `PartyResolutionMethod`
- `referenceResolutionStatusSchema` / `ReferenceResolutionStatus`
- `extractionReviewStatusSchema` / `ExtractionReviewStatus`
- `candidateWindowSourceMethodSchema` / `CandidateWindowSourceMethod`
- `offsetUnitSchema` / `OffsetUnit`
- `offsetDirectionSchema` / `OffsetDirection`
- `sourceLineRangeSchema` / `SourceLineRange`
- `evidenceSpanCandidateSchema` / `EvidenceSpanCandidate`
- `contractPartySchema` / `ContractParty`
- `definedTermSchema` / `DefinedTerm`
- `contractKeyDateSchema` / `ContractKeyDate`
- `contractContextSchema` / `ContractContext`
- `candidateWindowSchema` / `CandidateWindow`
- `partyResolutionSchema` / `PartyResolution`
- `rawObligationCandidateSchema` / `RawObligationCandidate`
- `verifiedEvidenceSpanSchema` / `VerifiedEvidenceSpan`
- `verifiedObligationCandidateSchema` / `VerifiedObligationCandidate`
- `referenceAwareExtractionResultSchema` / `ReferenceAwareExtractionResult`

Tests added:

- `apps/api/tests/unit/reference-aware-extraction.schemas.test.ts`

Files changed in the schema task:

- `apps/api/src/modules/extraction/reference-aware/reference-aware-extraction.schemas.ts`
- `apps/api/src/modules/extraction/reference-aware/index.ts`
- `apps/api/src/modules/extraction/index.ts`
- `apps/api/tests/unit/reference-aware-extraction.schemas.test.ts`
- `docs/obligation-extraction-integration-progress.md`
- `docs/obligation-extraction-integration-plan.md`

Documentation fallback-policy correction:

- Reference-aware extraction failures must not silently fall back to Groq or heuristic extraction.
- Transient failures should later use existing retryable processing semantics.
- Permanent failures should later fail the `EXTRACTION` stage explicitly.
- Any fallback behavior must be an explicit configuration mode and must be recorded in logs and extraction metadata.
- No fallback behavior is implemented in the schema task.

Validation results:

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`: passed, 30 files and 115 tests.
- API lint was not run during the schema task because `apps/api/package.json` does not define a `lint` script.

## Deterministic Source Utility Progress

Source utility file location:

- `apps/api/src/modules/extraction/reference-aware/source-index.ts`

Source index interface:

- `ContractSourceIndex`
- `ContractSourceLineInput`
- `ContractSourceLine`
- `ContractSourceVerificationError`
- `ContractSourceVerificationErrorCode`
- `ResolvedEvidenceSpan`
- `EvidenceSpanReference`
- `ResolvedEvidenceSpanWithRole`
- `normalizeSourceLineText(...)`

Construction paths:

- `new ContractSourceIndex(lines)` accepts explicit global line inputs and detects duplicate or missing global lines.
- `ContractSourceIndex.fromParsedPages(pages)` builds a global line index from existing `ParsedDocumentPage.lines`, preserving `pageNumber`, page-local `lineNumber`, original line text, normalized line text, and `DocumentTextExtractionMethod`.
- `ContractSourceIndex.fromSegments(segments)` builds from existing `DocumentTextSegment` values and preserves page number, line range-derived page-local line numbers where available, normalized text, and source method.

Resolution methods:

- `resolveEvidenceSpan(startLine, endLine)` treats `startLine` and `endLine` as global one-based line numbers.
- `resolveEvidenceSpans(spans)` validates multiple global spans, removes exact duplicate spans by `evidenceRole:startLine:endLine`, keeps roles, and does not merge non-contiguous spans.

Line-number assumptions:

- Existing parsed-page line numbers remain page-local and one-based.
- `ContractSourceIndex` adds a deterministic global one-based line index by document order when built from parsed pages or segments.
- Global line numbers are not page numbers. For example, global lines `632-634` resolve to the page containing those indexed source lines, not to page `634`.
- Line normalization never changes line numbering.

Source-normalization rules:

- `normalizeSourceLineText(...)` normalizes CRLF/CR to LF, collapses extraction-only horizontal whitespace, and trims leading/trailing whitespace.
- `ContractSourceLine.originalText` preserves the input line text separately.
- `ContractSourceLine.normalizedText` is the exact normalized source text used for quote reconstruction.

Deterministic invariants:

- Duplicate global source lines are reported as `DUPLICATE_GLOBAL_LINE` diagnostics and the first line wins.
- Missing global source lines between the first and last indexed line are reported as `MISSING_GLOBAL_LINE` diagnostics.
- Invalid non-positive or non-integer boundaries report `INVALID_GLOBAL_LINE`.
- Reversed spans report `REVERSED_SPAN` and do not reconstruct a quote.
- Missing start and end boundaries report `MISSING_START_LINE` and `MISSING_END_LINE`.
- Missing interior lines report `MISSING_GLOBAL_LINE`.
- `exactQuote` is reconstructed only from indexed normalized source lines, joined with `\n`.
- No LLM, persistence, provider selection, or active pipeline code uses this utility yet.

Tests added:

- `apps/api/tests/unit/reference-aware-source-index.test.ts`

Source-index test coverage:

- Global lines `632-634` resolve to the actual source page, never page `634`.
- Multi-page span resolution.
- Missing start line.
- Missing middle line.
- Reversed span.
- Duplicate span removal while keeping evidence roles.
- Two non-contiguous evidence spans remain separate.
- Exact quote reconstruction from normalized source lines.
- OCR-produced line support using `TESSERACT`.
- Duplicate and missing global line diagnostics.

Validation results after source-index task:

- Initial `corepack pnpm --filter @contract-obligation-tracker/api run typecheck` failed once on `exactOptionalPropertyTypes` because segment-derived input passed `pageLocalLineNumber: undefined`; fixed by omitting the optional property.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`: passed, 31 files and 125 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Blockers for candidate detection:

- The active pipeline still passes only `{ pageNumber, rawText }` into `ObligationExtractionProvider.extract(...)`; candidate detection will need a deliberate input-widening task or an offline source-index construction path.
- Candidate-window source text is not persisted as a first-class domain model; future candidate detection must decide whether to build windows from parsed pages, persisted page records, or segments.
- Global line numbering is deterministic inside `ContractSourceIndex`, but it is not yet stored or shared across pipeline stages.
- OCR pages currently preserve page-level text and source method, but not token-level layout; candidate detection should not assume true OCR bounding boxes.

## Deterministic Candidate-Window Detector Progress

Candidate-window detector file location:

- `apps/api/src/modules/extraction/reference-aware/candidate-window-detector.ts`

Fixture added:

- `datasets/contracts/reference-aware-candidate-window.txt`

Detector interface:

- `CandidateWindowDetectionConfig`
- `CandidateWindowCueMatch`
- `DetectedCandidateWindow`
- `detectCandidateWindowCue(line)`
- `detectCandidateWindows(sourceIndex, overrideConfig?)`
- `renderCandidateWindowForLlm(window)`

Broad cue detection implemented for:

- `shall`
- `must`
- `required to`
- `agrees to`
- `payable`
- `due`
- `no later than`
- `within` time periods
- before/after/following/prior-to event references
- daily, weekly, monthly, quarterly, annually, annual, yearly, recurring, and each-period recurrence cues
- `notify`, `deliver`, `submit`, `report`, `maintain`, `pay`, `return`, `provide`
- renewal, termination, terminate, notice
- upon expiration or termination

Explicit exclusions implemented for:

- definition-only lines such as `shall mean`
- section/article/schedule/exhibit headings by themselves
- table-of-contents entries
- identifiable recital lines
- interpretation boilerplate
- standalone `may` rights without a matching duty cue

Window behavior:

- Target lines are source-index lines with at least one included cue and no exclusion.
- Context uses configurable preceding and following source line counts.
- Windows are bounded by configurable max line count and max character count.
- Overlapping windows merge when their target lines are adjacent or overlapping.
- Close non-adjacent windows merge only when they share an exposed `sectionPath`.
- The detector avoids context-overlap chain merges across unrelated headings.
- Stable IDs are deterministic from global bounds, target global lines, cue types, and section path.
- `renderCandidateWindowForLlm(...)` preserves source numbers as `G{globalLine} P{page}:L{pageLocalLine}` and marks targets with `*`.
- `ContractSourceLineInput` and `ContractSourceLine` now preserve optional `sectionPath` for future segment-derived section metadata.

Candidate-window tests added:

- `apps/api/tests/unit/reference-aware-candidate-window-detector.test.ts`

Candidate-window test coverage:

- Definition containing `shall mean` is not an obligation target.
- Payment sentence is detected.
- Renewal-notice sentence is detected.
- Recurring report sentence is detected.
- Adjacent payer sentence and timing sentence land in the same window.
- Overlapping payment/timing windows merge.
- Distant clauses do not merge.
- Headings are preserved as context but are not targets.
- LLM rendering preserves source numbers.
- Repeated execution keeps window IDs stable.
- Exposed section paths are preserved and close same-section windows merge.
- Configured max line count bounds context growth.

Validation notes after candidate-window task:

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- Initial `corepack pnpm --filter @contract-obligation-tracker/api run test:unit` failed three detector expectations because context-overlap merging chained payment, reporting, and renewal windows together; fixed by merging context-overlapping windows only when target lines are adjacent/overlapping, with non-adjacent close merging limited to shared `sectionPath`.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/reference-aware-candidate-window-detector.test.ts`: passed, 10 tests before the section-path and max-line-count guard tests were added.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 32 files and 137 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Remaining blockers for Gemini extraction:

- Candidate windows are deterministic and tested but not yet wired into `ObligationExtractionProvider`.
- The active processing pipeline still passes only `{ pageNumber, rawText }` to the current provider boundary.
- A future integration task must decide whether Gemini receives rendered candidate windows, structured window metadata, or both.
- No prompt schema, Gemini adapter, provider selection, fallback policy implementation, or extraction-stage error mapping has been added yet.

## Provider-Neutral Structured LLM Progress

Structured LLM interface file location:

- `apps/api/src/infrastructure/llm/structured-llm-client.ts`

Exported neutral interfaces and helpers:

- `StructuredLlmRequest<T>`
- `StructuredLlmClient`
- `StructuredLlmPreflightClient`
- `parseStructuredJson(...)`
- `validateStructuredData(...)`

Neutral interface behavior:

- Accepts `operationName`, `systemInstruction`, `prompt`, JSON schema, and a Zod validator.
- Returns typed data only after JSON parsing and Zod validation.
- Contains no obligation-specific logic and no Gemini-specific fields.
- Treats invalid JSON and Zod validation failure as non-retryable `ExternalServiceError` cases.

Gemini structured client file location:

- `apps/api/src/infrastructure/llm/gemini-structured-llm.client.ts`

Exported Gemini interfaces and functions:

- `GeminiStructuredLlmClient`
- `classifyGeminiStructuredLlmError(...)`

Gemini client behavior:

- Dynamically imports the official `@google/genai` package only in `gemini-structured-llm.client.ts`.
- Reads `GEMINI_API_KEY` and `GEMINI_MODEL` only from parsed environment configuration passed to the constructor.
- Rejects missing `GEMINI_API_KEY` or `GEMINI_MODEL` as non-retryable configuration errors.
- Uses the SDK `models.generateContent(...)` path with `responseMimeType: "application/json"` and `responseSchema` isolated inside the Gemini provider.
- Parses the returned text as JSON, then validates the parsed value again with Zod.
- Exposes `preflight(signal?)`, using `models.get(...)` when the SDK exposes it, otherwise a small JSON generate-content probe.
- Classifies 400, 401, 403, 404, invalid JSON, and schema validation errors as non-retryable.
- Retries timeout, 408, 429, and transient 5xx failures up to configured limits.
- Uses configurable timeout, max attempts, and minimum request interval.
- Logs operation name, attempt, retryability, status, and provider message only; it does not log API keys or prompts.
- Supports an `AbortSignal` parameter through the neutral request and preflight method by passing both `signal` and `abortSignal` fields in the isolated SDK request object.

Fake structured client file location:

- `apps/api/src/infrastructure/llm/fake-structured-llm-client.ts`

Exported fake client types:

- `FakeStructuredLlmClient`
- `FakeStructuredLlmPromptRecord`

Fake client behavior:

- Queues responses and errors by operation name.
- Records operation name, system instruction, prompt, and JSON schema for assertions.
- Validates queued data with the request validator before returning it.
- Performs no network access.

Configuration added:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_REQUEST_TIMEOUT_MS`
- `GEMINI_MAX_ATTEMPTS`
- `GEMINI_MIN_REQUEST_INTERVAL_MS`

Files changed in the structured LLM task:

- `apps/api/src/infrastructure/llm/structured-llm-client.ts`
- `apps/api/src/infrastructure/llm/gemini-structured-llm.client.ts`
- `apps/api/src/infrastructure/llm/fake-structured-llm-client.ts`
- `apps/api/src/config/env.ts`
- `apps/api/tests/unit/env.test.ts`
- `apps/api/tests/unit/structured-llm-client.test.ts`
- `apps/api/package.json`
- `.env.example`
- `docs/obligation-extraction-integration-progress.md`

Dependency note:

- `apps/api/package.json` declares `@google/genai` at `^2.13.0`.
- No dependency install was run and `pnpm-lock.yaml` was not updated, following the "Do not install dependencies" instruction.

Structured LLM tests added:

- `apps/api/tests/unit/structured-llm-client.test.ts`

Structured LLM test coverage:

- Successful typed Gemini structured result.
- Invalid JSON is non-retryable.
- Zod validation failure is non-retryable.
- Timeout, rate limit, and transient 5xx errors classify as retryable.
- 400, 401, 403, and 404 errors classify as permanent.
- Exhausted retries stop after the configured attempt count.
- Gemini model preflight is exposed and testable without network access.
- Fake client prompt recording by operation name.
- Missing Gemini configuration is rejected.
- Env parsing covers the new Gemini structured LLM configuration.

Validation notes after structured LLM task:

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/structured-llm-client.test.ts --reporter=dot`: passed, 1 file and 8 tests before the preflight and env assertions were added.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/structured-llm-client.test.ts tests/unit/env.test.ts --reporter=dot`: passed, 2 files and 12 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 33 files and 147 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Historical blockers later resolved by the reference-aware integration task:

- The structured LLM client is now connected through `ReferenceAwareObligationExtractor`.
- Candidate-window prompts, raw obligation candidate extraction, source verification, party resolution, and legacy output mapping now exist.
- Dependency installation and lockfile update were completed in the stabilization pass.

## Contract-Level Context Extraction Progress

Context extractor file location:

- `apps/api/src/modules/extraction/reference-aware/contract-context-extractor.ts`

Exported context extraction interfaces and classes:

- `ContractContextExtractor`
- `ContractContextExtractorInput`
- `ContractContextExtractorConfig`
- `ContractContextExtractionResult`
- `ContractStructureHint`
- `VerifiedContextSource`
- `VerifiedContractParty`
- `VerifiedDefinedTerm`
- `VerifiedContractKeyDate`
- `VerifiedContractSectionHeading`
- `ContractContextRejectedItem`
- `ContractContextRejectedItemType`

Context extractor behavior:

- Uses `StructuredLlmClient` operation name `contract_context_extraction`.
- Sends only scoped source lines, preferring introductory pages, definition sections, term/renewal/notice/exhibit sections, and lines that look like party/date/definition context.
- Does not send the whole document in one request.
- Uses raw LLM output only for reference facts and global line spans.
- Extracts parties with canonical legal name, role label, aliases, and source span.
- Extracts defined terms with direct definitions or unresolved cross-references to referenced sections/exhibits.
- Extracts key dates such as effective date, commencement date, term dates, renewal date labels, and other explicit date labels.
- Accepts section headings from the LLM only when reliable structure is not already supplied by section hints or source-line `sectionPath`.
- Rejects invalid, missing, empty, or cross-page source spans instead of deriving page numbers from the LLM.
- Derives page-local source ranges and exact quotes through `ContractSourceIndex.resolveEvidenceSpan(...)`.
- Returns `ContractContext` plus verified parties, defined terms, key dates, section headings, and rejected context items.
- Produces no obligations, raw obligation candidates, persistence records, or pipeline output.

Relevant context selector file location:

- `apps/api/src/modules/extraction/reference-aware/contract-context-extractor.ts`

Exported selector interfaces and classes:

- `RelevantContextSelector`
- `RelevantContextSelectorConfig`
- `RelevantContextSelection`
- `CanonicalPartyMapEntry`

Relevant context selector behavior:

- Given a `DetectedCandidateWindow`, selects parties and defined terms that appear in the window or nearby source text.
- Always includes the canonical party map for every verified party.
- Filters defined terms by actual term mention in nearby text to avoid injecting the entire definition dictionary into every prompt.
- Selects key dates only when their label or raw value appears near the candidate window.

Tests added:

- `apps/api/tests/unit/contract-context-extractor.test.ts`

Contract-context test coverage:

- Network alias resolves to canonical `Acme Network Corporation`.
- Affiliate alias resolves to canonical `Beta Affiliate LLC`.
- Capitalized `Services` defined term is indexed with a verified page-local source range.
- `"Services" has the meaning in Exhibit D` remains an unresolved cross-reference and is not expanded.
- Invalid source lines are rejected.
- Irrelevant definitions are omitted from candidate-window prompt context.
- Party aliases appearing near a candidate window select the canonical party.
- Context extraction does not send a distant page line in the scoped prompt.
- LLM section headings are not accepted when structure is already supplied.
- The service produces no obligations or raw obligation candidates.

Validation notes after contract-context extraction task:

- Initial `corepack pnpm --filter @contract-obligation-tracker/api run typecheck` failed once on a readonly alias array mismatch with the existing Zod-inferred `ContractParty` type; fixed by returning the existing mutable alias-array shape.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/contract-context-extractor.test.ts --reporter=dot`: passed, 1 file and 10 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 34 files and 157 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Historical blockers later resolved by the reference-aware integration task:

- Contract context extraction is now connected through `ReferenceAwareObligationExtractor`.
- Candidate windows are now converted into obligation-stage prompts.
- Relevant context selection is now used by `ObligationCandidateExtractor`.
- Obligation candidate detection, evidence verification, party resolution, and legacy persistence mapping now exist.
- Dependency installation and lockfile update were completed in the stabilization pass.

## Window-Level Obligation Candidate Extraction Progress

Obligation candidate extractor file location:

- `apps/api/src/modules/extraction/reference-aware/obligation-candidate-extractor.ts`

Exported obligation candidate interfaces and classes:

- `ObligationCandidateExtractor`
- `ObligationCandidateExtractorInput`
- `ObligationCandidateExtractorConfig`
- `ObligationCandidateExtractionResult`
- `RejectedObligationCandidate`

Obligation candidate extractor behavior:

- Processes `DetectedCandidateWindow` values sequentially.
- Uses `StructuredLlmClient` operation name `obligation_candidate_extraction`.
- Uses `RelevantContextSelector` to include the canonical party map for all parties while limiting defined terms and key dates to window-relevant context.
- Prompts every window with exactly these sections:
  - `CONTRACT PARTY MAP`
  - `RELEVANT DEFINED TERMS`
  - `SECTION PATH`
  - `PREVIOUS/TARGET/FOLLOWING SOURCE LINES`
  - `EXTRACTION SCOPE`
  - `REFERENCE-RESOLUTION RULES`
- The prompt scope includes operationally trackable duties only: renewal/non-renewal notice, termination notice, payment, delivery, scheduled service/performance, reporting, notification, recurring operational duties, insurance/certificate duties, timed record retention, event-triggered and post-termination duties, and other concrete action plus timing/trigger duties.
- The prompt excludes definitions, recitals, descriptive statements, standalone permissions and rights, interpretation boilerplate, governing law, severability, entire agreement, broad liability language without trackable action, and general confidentiality or compliance with no timing or operational event.
- The model-facing schema accepts global line numbers only for evidence; it does not ask the LLM for page numbers or quotes.
- Page-local evidence spans and exact quotes are derived through `ContractSourceIndex.resolveEvidenceSpans(...)`.
- Party aliases are resolved against `ContractContextExtractionResult`; unresolved or ambiguous party references remain review-required instead of being guessed.
- Defined terms remain unchanged in candidate output.
- Unavailable or unresolved cross-references are marked review-required.
- Multiple source spans can support one obligation.
- Low-confidence candidates below the configured threshold are marked `REVIEW_REQUIRED`.
- Definition-only and rights-only model candidates are deterministically rejected.
- The service returns raw candidates, verified candidates, confirmed candidates, review-required candidates, and rejected candidates only in memory.
- No persistence, pipeline activation, provider selection, or database mapping was added.

Tests added:

- `apps/api/tests/unit/obligation-candidate-extractor.test.ts`

Obligation-candidate test coverage:

- Explicit actor resolves through the contract party map.
- Actor inherited from the previous sentence is supported when previous-line evidence establishes it.
- Defined payment term `Fees` remains unchanged and relevant definitions are included without unrelated definitions.
- Payment timing in the following sentence remains part of the same candidate.
- Unresolved `other party` actor is marked review-required.
- Unavailable `Exhibit D` cross-reference is marked review-required.
- Multiple evidence spans support one obligation.
- Rights-only clause is excluded.
- Definition-only clause is excluded.
- Low-confidence result is marked review-required.

Validation notes after obligation-candidate extraction task:

- Initial `corepack pnpm --filter @contract-obligation-tracker/api run typecheck` failed once because `signal: undefined` was passed under `exactOptionalPropertyTypes`; fixed by omitting `signal` unless present.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-candidate-extractor.test.ts --reporter=dot`: passed, 1 file and 10 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 35 files and 167 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Historical blockers later resolved by the reference-aware integration task:

- `ObligationCandidateExtractor` is now connected through `ReferenceAwareObligationExtractor`.
- The orchestration service now combines source indexing, candidate-window detection, contract-context extraction, window-level obligation extraction, source verification, deduplication, consolidation, and review gating.
- A mapper now converts confirmed source-verified obligations to the legacy `StructuredExtraction` / `FieldAnchor` format consumed by `DocumentTextProcessingPipeline`.
- Feature-flagged provider selection exists, and dependency installation plus lockfile update were completed in the stabilization pass.

## Source-Verified Operational Obligation Progress

Source verification file location:

- `apps/api/src/modules/extraction/reference-aware/obligation-source-verification.ts`

Exported source-verification interfaces and classes:

- `ObligationSourceVerifier`
- `ObligationSourceVerifierConfig`
- `ObligationSourceVerificationInput`
- `ObligationSourceVerificationItem`
- `ObligationSourceVerificationResult`
- `SourceVerifiedOperationalObligation`
- `SourceVerifiedEvidenceSpan`
- `RejectedSourceObligation`
- `ObligationDeduplicator`
- `ObligationConsolidator`
- `ObligationReviewGate`
- `ObligationReviewGateConfig`

Source verification behavior:

- Accepts explicit `{ candidate, window }` pairs plus `ContractSourceIndex`.
- Resolves every page-local `VerifiedObligationCandidate.verifiedEvidenceSpans[]` range back to global source lines through `ContractSourceIndex`.
- Reconstructs `globalStartLine`, `globalEndLine`, `startPage`, `endPage`, `exactQuote`, and `normalizedQuote` from the source index instead of trusting model-supplied quotes.
- Ensures every evidence span lies within the supplied `DetectedCandidateWindow.globalStartLine` and `DetectedCandidateWindow.globalEndLine`.
- Requires valid source evidence and `ACTION` evidence.
- Requires `ACTOR` evidence or a resolved contextual party-resolution method.
- Marks unresolved or ambiguous responsible parties as `REVIEW_REQUIRED`.
- Rejects invalid or missing source ranges, definition-only candidates, and rights-only candidates.
- Adds deterministic, precise review reasons such as missing source lines, out-of-window evidence, missing action evidence, unresolved responsible party, low confidence, or unresolved core cross-references.
- Emits `CONFIRMED`, `REVIEW_REQUIRED`, and `REJECTED` statuses through `ObligationReviewGate`.

Deduplication behavior:

- `ObligationDeduplicator.deduplicate(...)` removes exact duplicates from overlapping windows using a deterministic key based on business type, timing, resolved parties, action, object, timing fields, section path, and exact global evidence spans.
- It does not merge obligations merely because summaries are similar.
- Duplicate source candidate keys and review reasons are preserved as sorted unique arrays.

Consolidation behavior:

- `ObligationConsolidator.consolidate(...)` combines adjacent or overlapping fragments only when deterministic matching factors agree: responsible party, counterparty, normalized action, specific obligation object, section path, and adjacent/overlapping evidence.
- It can combine actor/action evidence with separate timing evidence for the same duty.
- It preserves all distinct source evidence spans and source candidate keys.
- It keeps object-specific duties separate, including `Advertising Share` and `Transactional Share`.
- No optional LLM consolidation pass was introduced.

Tests added:

- `apps/api/tests/unit/obligation-source-verification.test.ts`

Source-verification test coverage:

- Obligations from overlapping windows deduplicate.
- Identical line span and actor deduplicate.
- Payment action plus timing sentence consolidate.
- `Advertising Share` and `Transactional Share` remain separate.
- Unresolved actor requires review.
- Invalid source is rejected.
- Definition candidate is rejected.
- Exact pages and quotes are reconstructed from `ContractSourceIndex`.
- Processing the same candidates twice gives identical output and stable IDs.

Validation notes after source-verification task:

- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-candidate-extractor.test.ts --reporter=dot`: passed, 1 file and 10 tests.
- Initial `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-source-verification.test.ts --reporter=dot` failed once because same-line evidence roles sorted alphabetically; fixed by applying a stable semantic role order.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-source-verification.test.ts --reporter=dot`: passed, 1 file and 9 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 36 files and 176 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Historical blockers later resolved by the reference-aware integration task:

- Source-verified operational obligations are now connected to `DocumentTextProcessingPipeline` through `ReferenceAwareObligationExtractor`.
- The orchestration service now runs context extraction, candidate-window detection, candidate extraction, source verification, deduplication, consolidation, and review gating as one provider flow.
- A mapper now converts `SourceVerifiedOperationalObligation` to the legacy `StructuredExtraction` / `FieldAnchor` format.
- Provider union and feature-flag selection exist, and dependency installation plus lockfile update were completed in the stabilization pass.

## Reference-Aware Pipeline Integration Progress

Reference-aware orchestration file location:

- `apps/api/src/modules/extraction/reference-aware/reference-aware-obligation-extractor.ts`

Exported integration interfaces and classes:

- `ReferenceAwareObligationExtractor`
- `ReferenceAwareObligationExtractorConfig`
- `ReferenceAwareObligationExtractorMetricsSnapshot`

Implemented orchestration flow:

1. `ObligationExtractionInput` source input
2. `ContractSourceIndex`
3. `detectCandidateWindows(...)`
4. `ContractContextExtractor`
5. `ObligationCandidateExtractor`, run sequentially one window at a time
6. `ObligationSourceVerifier`
7. `ObligationDeduplicator`
8. `ObligationConsolidator`
9. `ObligationReviewGate`
10. legacy `StructuredExtraction` result

Feature flag and runtime integration:

- `OBLIGATION_EXTRACTOR_MODE` was added in `apps/api/src/config/env.ts`.
- Allowed values are `auto`, `heuristic`, `groq`, and `reference-aware-gemini`.
- Default is `auto`.
- `.env.example` documents `OBLIGATION_EXTRACTOR_MODE=auto`.
- `createObligationExtractor(...)` was added in `apps/api/src/bootstrap/register-workers.ts`.
- `createWorkerRuntime(...)` now calls `createObligationExtractor(...)` and passes the selected provider into `DocumentTextProcessingPipeline`.
- `ReferenceAwareObligationExtractor` is instantiated with `GeminiStructuredLlmClient` only when the feature flag explicitly selects `reference-aware-gemini`.
- `GeminiStructuredLlmClient` remains the only file importing `@google/genai`.

Provider boundary changes:

- `ObligationExtractionInput` in `apps/api/src/modules/extraction/obligation-extraction.provider.ts` now accepts optional `segmentedPages`.
- `ObligationExtractionResult.provider` now includes `REFERENCE_AWARE_GEMINI`.
- `ObligationExtractionResult` now accepts optional `metadata`.
- `DocumentTextProcessingPipeline.run(...)` still builds the legacy `pages` array and now also passes the already-created `segmentedPages` to the provider.
- Parsing, OCR, segmentation, storage, persistence repositories, scheduler, and state-machine services were not replaced.

Legacy output adapter:

- `ReferenceAwareObligationExtractor` maps only `CONFIRMED` `SourceVerifiedOperationalObligation` values into `StructuredExtraction.obligations`.
- The adapter creates `FieldAnchor` values with `source: "reference_aware_obligation"`.
- Anchor metadata includes page-local `start_line`, `end_line`, `line_offset`, exact quoted text, resolved parties, action, object, timing, confidence, review status, source evidence records, and source candidate keys.
- `DocumentTextProcessingPipeline.toExtractedObligations(...)` remains the persistence mapper for active obligations.

Review preservation:

- `REVIEW_REQUIRED` candidates are not placed in `StructuredExtraction.obligations`, so they are not persisted as active obligations by `upsertExtractedForContract(...)`.
- Review-required and rejected candidate summaries and reasons are preserved in `ObligationExtractionMetadata`.
- `DocumentTextProcessingPipeline.run(...)` includes extraction metadata in the `CONTRACT_OBLIGATIONS_EXTRACTED` audit event.
- If review candidates exist, the pipeline returns the existing `REVIEW_REQUIRED` processing outcome with `reviewItemCount`.
- No database migration or new obligation review table/state was added.

Failure semantics:

- Reference-aware failures do not silently fall back to heuristic or Groq extraction.
- `DocumentTextProcessingPipeline.run(...)` logs `contract_obligation_extraction_failed` with contract/document/run IDs, sanitized message, and retryability only.
- Extraction failures are wrapped as `OBLIGATION_EXTRACTION_FAILED` at stage `EXTRACTION`.
- Retryability is derived from existing `ApplicationError.details.retryable` when present; otherwise extraction failures default to retryable.

Structured metrics:

- `candidateWindows`
- `rawCandidates`
- `confirmed`
- `reviewRequired`
- `rejected`
- `duplicateRemovals`
- `consolidations`
- `llmRequestCount`
- `retryCount`
- `extractionDurationMilliseconds`

Metrics are emitted in the `reference_aware_obligations_extracted` structured log and returned in `ObligationExtractionMetadata.metrics`. LLM request metrics are computed per extraction run so reused worker instances do not accumulate stale counts.

Tests added or updated:

- `apps/api/tests/unit/reference-aware-obligation-extractor.test.ts`
- `apps/api/tests/unit/document-text-processing.pipeline.test.ts`
- `apps/api/tests/unit/register-workers.test.ts`
- `apps/api/tests/unit/env.test.ts`

Integration test coverage:

- Heuristic mode defaults to the old provider path.
- `reference-aware-gemini` mode selects `ReferenceAwareObligationExtractor`.
- Confirmed source-verified obligations map into the existing output contract and persistence mapper.
- Review candidates are preserved in metadata and are not treated as confirmed obligations.
- Gemini/reference-aware extraction failure does not silently produce heuristic results.
- Reprocessing the same source and candidates gives stable output and IDs.
- Existing pipeline tests still pass with optional `segmentedPages`.

Validation notes after reference-aware integration task:

- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/reference-aware-obligation-extractor.test.ts tests/unit/document-text-processing.pipeline.test.ts tests/unit/register-workers.test.ts tests/unit/env.test.ts --reporter=dot`: passed, 4 files and 18 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit --passWithNoTests --reporter=dot`: passed, 37 files and 184 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Remaining blockers for production activation:

- `@google/genai` is now installed and locked in `apps/api/package.json` and `pnpm-lock.yaml`.
- The review metadata is preserved in processing/audit result structures, not in a dedicated review-candidate table.
- The legacy `obligations` table still upserts by title, so title collisions remain possible for confirmed obligations.
- Runtime Gemini use requires `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL`.

## Reference-Aware Stabilization Progress

Stabilization report:

- `docs/reference-aware-stabilization-report.md`

Provider mode compatibility:

- `OBLIGATION_EXTRACTOR_MODE` now accepts `auto`, `heuristic`, `groq`, and `reference-aware-gemini`.
- Default is `auto`.
- `auto` preserves the prior worker behavior: `GroqObligationExtractionProvider` when `GROQ_API_KEY` is configured, otherwise `HeuristicObligationExtractionProvider`.
- Explicit `heuristic` selects `HeuristicObligationExtractionProvider` even when a Groq key exists.
- Explicit `groq` requires `GROQ_API_KEY`.
- Explicit `reference-aware-gemini` requires `GEMINI_API_KEY` and `GEMINI_MODEL`.
- `ReferenceAwareObligationExtractor` is still selected only by explicit `reference-aware-gemini`.
- Reference-aware Gemini failures do not silently fall back to Groq or heuristics.

Dependency status:

- `@google/genai` was installed for `@contract-obligation-tracker/api`.
- `apps/api/package.json` now declares `@google/genai` as `^2.13.0`.
- `pnpm-lock.yaml` now includes `@google/genai@2.13.0` and its transitive dependencies.
- `corepack pnpm install --frozen-lockfile` passed after the lockfile update.
- The lockfile was regenerated by pnpm and includes broad YAML quoting-style churn in addition to the intended Gemini dependency entries.

Stabilized source and evidence invariants:

- `ContractSourceIndex` remains the source of truth for page ranges and exact quotes.
- Model-provided quote text is ignored during source verification.
- Missing source boundaries and missing middle lines reject evidence spans deterministically.
- Evidence outside the supplied candidate window rejects the candidate.
- Single raw evidence spans that cross pages are rejected; cross-page evidence must use multiple page-local spans.
- Review metadata uses compact `sourceReferences` and removes duplicate line references.
- Review metadata remains JSON-safe and does not include API keys, complete prompts, or complete contract bodies.

Stabilized identity and consolidation invariants:

- `stableCandidateKey` in `ObligationCandidateExtractor` is based on normalized semantic fields and sorted evidence spans.
- Candidate keys are stable across repeated execution, candidate ordering, and evidence-span ordering.
- Different obligation objects receive different candidate keys.
- `ObligationDeduplicator` removes exact duplicates from overlapping windows only.
- `ObligationConsolidator` remains deterministic and idempotent.
- Actor/action fragments consolidate with adjacent timing fragments only when party, counterparty, action, object, section path, and evidence adjacency match.
- Similar obligations in separate sections do not consolidate.
- Same actor and frequency with different objects do not consolidate, including share/payment-style clauses.
- Duplicate evidence spans are sorted and removed after verification/consolidation.

Metrics and logging status:

- `StructuredLlmMetricsProvider` and `StructuredLlmMetricsSnapshot` were added in `apps/api/src/infrastructure/llm/structured-llm-client.ts`.
- `GeminiStructuredLlmClient` implements `getMetricsSnapshot()` and records retry attempts only when a retryable failure is actually retried.
- `ReferenceAwareObligationExtractor` includes retry counts from metrics-capable LLM delegates.
- Reference-aware extraction metrics include candidate windows, raw candidates, confirmed, review required, rejected, duplicate removals, consolidations, LLM request count, retry count, and extraction duration.
- Logs and metadata remain sanitized; tests assert no API key, complete prompt, or complete contract body is stored in reference-aware review metadata.

Additional tests added or strengthened:

- `apps/api/tests/unit/env.test.ts`
- `apps/api/tests/unit/register-workers.test.ts`
- `apps/api/tests/unit/structured-llm-client.test.ts`
- `apps/api/tests/unit/obligation-candidate-extractor.test.ts`
- `apps/api/tests/unit/obligation-source-verification.test.ts`
- `apps/api/tests/unit/reference-aware-obligation-extractor.test.ts`

New stabilization coverage:

- `auto` mode selects Groq when `GROQ_API_KEY` exists.
- `auto` mode selects heuristic when `GROQ_API_KEY` is absent.
- Explicit `heuristic`, `groq`, and `reference-aware-gemini` modes select the intended provider.
- Explicit Groq and reference-aware Gemini modes fail fast when required keys are missing.
- Gemini retry metrics are recorded for actual retry attempts.
- Cross-page raw evidence must use multiple spans.
- Stable candidate keys ignore candidate/evidence order and still distinguish different objects.
- Missing middle source lines reject evidence.
- Evidence outside a candidate window is rejected.
- Exact quotes are reconstructed from source, not model text.
- Similar obligations across different sections do not consolidate.
- Same actor/frequency with different objects does not consolidate.
- Consolidation remains idempotent.
- Review metadata is compact and JSON-safe.
- Duplicate removal, consolidation, LLM request count, retry count, and extraction duration metrics are asserted.

Validation notes after stabilization:

- First non-escalated `corepack pnpm --filter @contract-obligation-tracker/api add @google/genai` failed because the pnpm store location was unexpected and registry access was denied by the sandbox.
- Escalated `corepack pnpm --filter @contract-obligation-tracker/api add @google/genai` succeeded.
- Non-interactive sandboxed `corepack pnpm install --frozen-lockfile` hit registry access denial after node_modules was recreated.
- Escalated `corepack pnpm install --frozen-lockfile` succeeded.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-source-verification.test.ts --reporter=dot`: passed, 1 file and 13 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/obligation-candidate-extractor.test.ts --reporter=dot`: passed, 1 file and 12 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/reference-aware-obligation-extractor.test.ts --reporter=dot`: passed, 1 file and 5 tests.
- An intermediate `corepack pnpm --filter @contract-obligation-tracker/api run typecheck` failed because a compact metadata helper used a readonly array annotation while building an array mutably; fixed in `apps/api/src/modules/extraction/reference-aware/reference-aware-obligation-extractor.ts`.
- Final `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- Final `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`: passed, 37 files and 200 tests.
- Final `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.
- API unit tests emitted expected stderr logs for negative route cases: unauthenticated upload, oversized upload, and not-found response.

## Risks And Ambiguities

- `ObligationExtractionInput` has been widened with optional `segmentedPages`; `HeuristicObligationExtractionProvider` remains compatible because it only reads `pages`.
- The active pipeline still has no global line-number model; `ContractSourceIndex` provides internal deterministic global numbering for the reference-aware path, then maps back to page-local source ranges when needed.
- Anchor boxes are synthetic in `toAnchorRecord(...)`; true PDF coordinate anchoring would require a separate design and should not be implied by replacing extraction.
- OCR pages lose layout-level OCR tokens because `pageFromOcrResult(...)` creates a single whole-page `textItems` entry.
- Upsert by title can merge two obligations with identical titles within a contract.
- `extractFieldsFromPages(...)` also supports non-obligation structured fields, but only `extraction.obligations` are persisted by the active pipeline.

## Recommended Next Task

Run a controlled manual worker test with `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`, a valid non-production `GEMINI_API_KEY`, and `GEMINI_MODEL` against the exact TubeMediaCorp/Charter Affiliate Agreement fixture. The PDF is available in the ignored raw CUAD tree but not currently copied into `working-subset/contracts/`. Inspect extraction audit metadata and confirmed obligation anchors before designing durable review-candidate persistence.

## Reference-Aware Gemini Smoke Validation Progress

Smoke report:

- `docs/reference-aware-smoke-test-report.md`

Controlled entry point added:

- `apps/api/src/scripts/run-reference-aware-extraction-smoke.ts`

Smoke entry point behavior:

- Requires `OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL`.
- Defaults to non-persisting behavior.
- Saves sanitized output under ignored `dev-output/reference-aware-smoke/`.
- Runs `GeminiStructuredLlmClient.preflight(...)` before reading or parsing the PDF, so authentication/model failures stop before document processing.
- Uses existing PDF parsing, OCR fallback, segmentation, source indexing, context extraction, candidate extraction, source verification, deduplication, and consolidation components when preflight succeeds.
- Keeps Gemini calls sequential and honors configured request spacing.

Representative contract selected:

- `working-subset/contracts/contract-001__SouthernStarEnergyInc_20051202_SB-2A_EX-9_801890_EX-9_Affiliate Agreement.pdf`

Lockfile review:

- `git diff --stat pnpm-lock.yaml` reported 1 file changed, 1734 insertions and 2843 deletions.
- `git diff --word-diff=plain pnpm-lock.yaml` showed `@google/genai@2.13.0` plus expected Google SDK transport/auth transitive dependencies.
- No unrelated dependency version bump was identified in the inspected lockfile diff; the large diff is pnpm formatting/quoting churn plus Gemini dependency entries.

Real provider preflight results:

- Initial non-escalated smoke attempt reached provider setup but failed with `fetch failed` under network restriction.
- Escalated smoke attempts reached Google and failed with permanent HTTP 400 `API_KEY_INVALID`.
- Final clean command from `apps/api` stopped at `gemini_model_preflight` with `attempts: 1`, `status: 400`, and `retryable: false`.
- No fallback to Groq or heuristic extraction occurred.
- Because preflight failed, no PDF parsing, OCR, segmentation, candidate windows, context extraction, obligation-window extraction, source invariant checks, persistence, or idempotency comparison ran.

Runtime defect found and fixed:

- `GeminiStructuredLlmClient.preflight(...)` initially destructured `client.models.get`, which lost the SDK receiver and produced `Cannot read properties of undefined (reading 'apiClient')`.
- Fixed by calling `client.models.get!(...)` through the `models` receiver.
- Added a receiver-sensitive regression test in `apps/api/tests/unit/structured-llm-client.test.ts`.

Validation commands after smoke fixes:

- `corepack pnpm --filter @contract-obligation-tracker/api exec vitest run tests/unit/structured-llm-client.test.ts --reporter=dot`: passed, 1 file and 11 tests.
- `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`: passed.
- `corepack pnpm install --frozen-lockfile`: exited 0 in the current workspace.
- `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`: passed, 37 files and 200 tests.
- `corepack pnpm -r --if-present run lint`: passed; no package-specific lint output.

Current smoke blockers:

- A valid Gemini API key is required. The configured key is rejected by Google as `API_KEY_INVALID`, so the reference-aware real-Gemini smoke test remains NOT READY.
- The exact requested TubeMediaCorp/Charter Affiliate Agreement fixture is not present in `working-subset/contracts/`; it exists in the ignored raw CUAD PDF tree. The current `working-subset` `contract-001` fixture is SouthernStarEnergy and must not be used for the targeted payment-share validation.

Recommended next task:

- Configure a valid non-production `GEMINI_API_KEY` for the selected `GEMINI_MODEL`, copy the raw TubeMediaCorp PDF to `working-subset/contracts/contract-001__TubeMediaCorp_20060310_8-K_EX-10.1_513921_EX-10.1_Affiliate Agreement.pdf`, then rerun the two non-persisting reference-aware smoke runs before attempting isolated persistence.

## Reference-Aware Gemini Quota Optimization

Report updates:

- `docs/reference-aware-quota-optimization-report.md`
- `docs/reference-aware-smoke-test-report.md`
- `docs/reference-aware-working-app-report.md`

Current real-provider result:

- `corepack pnpm --filter @contract-obligation-tracker/api run gemini:doctor` passed with the local ignored `.env` key.
- The doctor listed 41 models and selected `gemini-3.5-flash-lite` from configuration.
- Structured-output preflight passed.
- A real non-persisting TubeMediaCorp smoke run completed under the default Gemini request budget.

Quota and request-budget changes:

- Gemini 429 errors are parsed into quota categories with support for `Retry-After`, Google `RetryInfo`, and `QuotaFailure`.
- Daily quota failures fail fast.
- Retryable quota failures use bounded retries and capped delays.
- Default Gemini request spacing is now 15 seconds.
- The smoke script computes the request plan before LLM extraction.
- Candidate extraction batches windows and validates returned `windowId` values.

Successful smoke artifact:

- `dev-output/reference-aware-working-app/reference-aware-smoke-1784864527229.json`

Successful smoke metrics:

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
- source invariant failures: 0

Payment validation:

- `Affiliate Advertising Share` was found, confirmed, and kept separate.
- `Affiliate Transactional Share` was found, confirmed, and kept separate.
- Payment validation summary: `dev-output/reference-aware-working-app/payment-validation.json`

Remaining blockers:

- Completed-result cache is not implemented.
- Checkpoint/resume flags are parsed but functional checkpoint/resume is not implemented.
- A second cached Gemini-free run was not executed.
- Persistence and idempotency were not validated.
- Frontend upload, worker queue processing, and PDF/source-anchor navigation were not validated.

## Gemini Model Discovery Repair

Report updates:

- `docs/reference-aware-working-app-report.md`
- `docs/reference-aware-smoke-test-report.md`

Model selection status:

- Gemini model discovery now uses SDK `supportedActions` as the primary field.
- Missing or empty `supportedActions` is inconclusive and falls through to direct structured preflight.
- REST-style `supportedGenerationMethods` remains a guarded compatibility fallback.
- `models.list()` errors are no longer converted to empty model lists.
- `GEMINI_MODEL` is optional; configured values are normalized and attempted before the default candidates.
- Default candidates are `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, and `gemini-2.5-flash-lite`.
- The selected model is cached after `selectUsableModel()` succeeds.

Current real-provider result:

- `corepack pnpm --filter @contract-obligation-tracker/api run gemini:doctor` passed with the local ignored `.env` key.
- The doctor listed 41 models and selected `gemini-3.5-flash-lite` from configuration.
- Structured-output preflight passed.
- Authentication is valid.

Smoke status:

- The smoke script now requires only `GEMINI_API_KEY`, not `GEMINI_MODEL`.
- Preflight `maxOutputTokens=32` is scoped to the preflight request only.
- Obligation-candidate nested JSON schema was aligned with the existing party/evidence validator.
- The full live smoke currently reaches obligation candidate extraction and is blocked by Gemini HTTP 429 quota/rate limiting.
- A throttled one-run retry with `GEMINI_MIN_REQUEST_INTERVAL_MS=12000` exceeded the 5-minute command timeout without writing a successful report.

Validation after this repair:

- Focused Gemini/env/doctor/worker/reference-aware tests passed: 40 tests.
- Full API unit suite passed: 38 files and 211 tests.
- API typecheck passed.
- Root lint passed.
- Focused extraction/schema tests passed after the live-smoke schema fix: 31 tests.

## Working Local App Remediation Progress

Working-app report:

- `docs/reference-aware-working-app-report.md`

Security and configuration changes:

- `.env.example` now uses placeholder-only Gemini values and no real Gemini key.
- `.env` remains ignored by `.gitignore`.
- Gemini env parsing trims `GEMINI_API_KEY` and `GEMINI_MODEL`, treats empty strings as absent, rejects placeholder Gemini values in explicit reference-aware mode, and keeps `GOOGLE_API_KEY` separate from `GEMINI_API_KEY`.
- Gemini SDK errors now redact the configured key from logs and thrown metadata.

New diagnostic:

- `corepack pnpm --filter @contract-obligation-tracker/api run gemini:doctor`
- The doctor uses the real `GeminiStructuredLlmClient`, lists accessible `generateContent` models, validates the configured model, and then performs a strict structured-output request.
- Current local result is blocked: no accessible `generateContent` models were returned for `GEMINI_MODEL=gemini-3.5-flash-lite`, so structured-output validation and extraction did not run.

Correct fixture status:

- The exact TubeMediaCorp PDF exists under the ignored raw CUAD tree.
- The matching raw text contains both `Affiliate Advertising Share` and `Affiliate Transactional Share`.
- The smoke script now defaults to the TubeMediaCorp raw PDF and fails with `WRONG_CONTRACT_FIXTURE` if parsed text misses either term.

Local baseline validation:

- API health passed in explicit heuristic mode.
- Standalone worker registered in explicit heuristic mode without Gemini.
- Frontend dev server served the root app shell.
- API typecheck passed.
- API unit tests passed: 38 files and 210 tests.
- Repo lint passed.
- Frontend typecheck and build passed.

Remaining blocker:

- Real reference-aware extraction, persistence, frontend upload verification, PDF anchor verification, and idempotency verification remain blocked until `gemini:doctor` succeeds with a valid local Gemini key/model.

## Final Local Integration Validation

Detailed report:

- `docs/final-application-wiring-report.md`

Final backend status:

- `corepack pnpm dev` starts the Vite frontend and the API process; the API process embeds worker and scheduler registration.
- The exact TubeMediaCorp raw CUAD PDF was uploaded through `POST /api/v1/contracts`.
- The final validation contract is `bc27463d-3668-4056-b974-0440cd74b129`.
- Worker provider was `REFERENCE_AWARE_GEMINI`; no Groq or heuristic fallback was used.
- Processing reached terminal `REVIEW_REQUIRED` because review candidates were emitted.
- Confirmed active obligations persisted: 9.
- Review-required candidates remained out of active obligations.
- Both `Affiliate Advertising Share` and `Affiliate Transactional Share` persisted as separate confirmed payment obligations.
- Authenticated PDF streaming returned `200`, `206`, `416`, and `404` behavior as expected.
- A duplicate `PROCESS_CONTRACT` replay job completed as `ALREADY_TERMINAL` without rerunning extraction.

Still not fully ready:

- Browser-controlled frontend upload and source-click verification was blocked by the in-app browser tool reporting no available browser session.
