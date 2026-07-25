/**
 * @file Defines a backend operational script for local maintenance or diagnostics.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import { loadEnv } from "../config/env.js";
import type { Logger } from "../config/logger.js";
import { GeminiStructuredLlmClient } from "../infrastructure/llm/gemini-structured-llm.client.js";
import { PdfJsPageRendererAdapter } from "../infrastructure/pdf/pdfjs-page-renderer.adapter.js";
import { NativePdfTextExtractorAdapter } from "../infrastructure/pdf/native-pdf-text-extractor.adapter.js";
import { TesseractOcrAdapter } from "../infrastructure/ocr/tesseract.adapter.js";
import type { OcrProvider, OcrResult } from "../infrastructure/ocr/ocr-provider.js";
import type { ParsedDocumentPage } from "../modules/document-processing/document-processing.types.js";
import { evaluateTextQuality } from "../modules/document-processing/document-quality.js";
import { segmentDocumentPages } from "../modules/document-processing/text-segmentation.js";
import {
  normalizeExtractedText,
  splitPageLines,
} from "../modules/document-processing/text-normalizer.js";
import {
  ContractContextExtractor,
  ContractSourceIndex,
  ObligationCandidateExtractor,
  ObligationConsolidator,
  ObligationDeduplicator,
  ObligationSourceVerifier,
  buildCandidateWindowBatches,
  detectCandidateWindows,
  type CandidateWindowBatch,
  type ContractContextExtractionResult,
  type DetectedCandidateWindow,
  type SourceVerifiedOperationalObligation,
} from "../modules/extraction/reference-aware/index.js";

interface CliOptions {
  readonly pdfPath: string;
  readonly outDir: string;
  readonly runs: number;
  readonly persist: boolean;
  readonly resume: boolean;
  readonly restart: boolean;
}

interface SmokeLogEvent {
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly details: Record<string, unknown>;
}

interface SmokeRunResult {
  readonly runIndex: number;
  readonly preflightRequestCount: number;
  readonly pageCount: number;
  readonly requiredPaymentTermsPresent: boolean;
  readonly parsedPageCount: number;
  readonly ocrPageCount: number;
  readonly segmentCount: number;
  readonly sourceLineCount: number;
  readonly candidateWindowCount: number;
  readonly candidateBatchCount: number;
  readonly requestPlan: ReturnType<typeof buildRequestPlan>;
  readonly contractContextCallCount: number;
  readonly obligationWindowCallCount: number;
  readonly totalGeminiRequestCount: number;
  readonly retryCount: number;
  readonly durationMilliseconds: number;
  readonly context: ReturnType<typeof summarizeContext>;
  readonly metrics: {
    readonly rawCandidates: number;
    readonly verifiedCandidates: number;
    readonly confirmed: number;
    readonly reviewRequired: number;
    readonly rejected: number;
    readonly duplicateRemovals: number;
    readonly consolidations: number;
  };
  readonly confirmedObligations: readonly ReturnType<typeof summarizeObligation>[];
  readonly reviewRequired: readonly ReturnType<typeof summarizeObligation>[];
  readonly rejected: readonly {
    readonly stableCandidateKey: string;
    readonly summary: string;
    readonly reviewReasons: readonly string[];
  }[];
  readonly invariantValidation: ReturnType<typeof validateConfirmedObligations>;
  readonly paymentExample: ReturnType<typeof summarizePaymentExample>;
}

const defaultPdfPath = join(
  "raw",
  "cuad",
  "CUAD_v1",
  "full_contract_pdf",
  "Part_I",
  "Affiliate_Agreements",
  "TubeMediaCorp_20060310_8-K_EX-10.1_513921_EX-10.1_Affiliate Agreement.pdf",
);
const smokeContractId = "00000000-0000-4000-8000-000000000101";
const smokeDocumentId = "00000000-0000-4000-8000-000000000102";
const smokeProcessingRunId = "00000000-0000-4000-8000-000000000103";
const smokeOrganizationId = "00000000-0000-4000-8000-000000000104";

/**
 * @description Runs the parse args script step for local operations.
 * @param {readonly string[]} argv - Input value for argv.
 * @returns {CliOptions} Result of the parse args operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function parseArgs(argv: readonly string[]): CliOptions {
  let pdfPath = defaultPdfPath;
  let outDir = join("dev-output", "reference-aware-smoke");
  let runs = 1;
  let persist = false;
  let resume = false;
  let restart = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pdf") {
      pdfPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      outDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--runs") {
      runs = Number(argv[index + 1] ?? "1");
      index += 1;
      continue;
    }
    if (arg === "--persist") {
      const value = argv[index + 1] ?? "false";
      persist = value === "true";
      index += 1;
      continue;
    }
    if (arg === "--resume") {
      resume = true;
      continue;
    }
    if (arg === "--restart") {
      restart = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!pdfPath) {
    throw new Error("--pdf requires a path");
  }
  if (!Number.isInteger(runs) || runs < 1 || runs > 2) {
    throw new Error("--runs must be 1 or 2");
  }

  return {
    pdfPath: resolve(pdfPath),
    outDir: resolve(outDir),
    runs,
    persist,
    resume,
    restart,
  };
}

/**
 * @description Runs the sanitize value script step for local operations.
 * @param {unknown} value - Input value for value.
 * @returns {unknown} Result of the sanitize value operation.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/api[_-]?key|token|secret|password/i.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      if (/prompt|contractText|rawText|pages/i.test(key)) {
        output[key] = "[OMITTED]";
        continue;
      }
      output[key] = sanitizeValue(nested);
    }
    return output;
  }
  return value;
}

class SmokeLogger implements Logger {
  readonly events: SmokeLogEvent[] = [];

  /**
   * @description Runs the info script step for local operations.
   * @param {string} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {void} Result of the info operation.
   */
  info(message: string, details: Record<string, unknown> = {}): void {
    this.record("info", message, details);
  }

  /**
   * @description Runs the warn script step for local operations.
   * @param {string} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {void} Result of the warn operation.
   */
  warn(message: string, details: Record<string, unknown> = {}): void {
    this.record("warn", message, details);
  }

  /**
   * @description Runs the error script step for local operations.
   * @param {string} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {void} Result of the error operation.
   */
  error(message: string, details: Record<string, unknown> = {}): void {
    this.record("error", message, details);
  }

  /**
   * @description Runs the count requests script step for local operations.
   * @param {string} operationName - Input value for operation name.
   * @returns {number} Result of the count requests operation.
   */
  countRequests(operationName?: string): number {
    return this.events.filter(
      (event) =>
        event.message === "gemini_structured_llm_request" &&
        (!operationName || event.details.operationName === operationName),
    ).length;
  }

  /**
   * @description Runs the record script step for local operations.
   * @param {"info" | "warn" | "error"} level - Input value for level.
   * @param {string} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {void} Result of the record operation.
   */
  private record(
    level: "info" | "warn" | "error",
    message: string,
    details: Record<string, unknown>,
  ): void {
    this.events.push({
      level,
      message,
      details: sanitizeValue(details) as Record<string, unknown>,
    });
  }
}

/**
 * @description Runs the page from ocr result script step for local operations.
 * @param {ParsedDocumentPage} basePage - Input value for base page.
 * @param {OcrResult} result - Input value for result.
 * @param {Parameters<typeof evaluateTextQuality>[1]} qualityConfig - Input value for quality config.
 * @returns {ParsedDocumentPage} Result of the page from ocr result operation.
 */
function pageFromOcrResult(
  basePage: ParsedDocumentPage,
  result: OcrResult,
  qualityConfig: Parameters<typeof evaluateTextQuality>[1],
): ParsedDocumentPage {
  const normalizedText = normalizeExtractedText(result.text);
  const quality = evaluateTextQuality(normalizedText, qualityConfig);
  return {
    ...basePage,
    text: normalizedText,
    lines: splitPageLines(basePage.pageNumber, normalizedText),
    rawText: result.text,
    normalizedText,
    textItems: normalizedText ? [{ pageNumber: basePage.pageNumber, text: normalizedText }] : [],
    charCount: quality.charCount,
    wordCount: quality.wordCount,
    printableRatio: quality.printableRatio,
    extractionMethod: result.provider,
    ocrConfidence: result.confidence,
    warnings: [...quality.warnings, ...(result.warnings ?? [])],
  };
}

/**
 * @description Runs the with timeout script step for local operations.
 * @param {Promise<T>} work - Input value for work.
 * @param {number} timeoutMilliseconds - Input value for timeout milliseconds.
 * @returns {Promise<T>} Result of the with timeout operation.
 */
async function withTimeout<T>(work: Promise<T>, timeoutMilliseconds: number): Promise<T> {
  return await new Promise<T>((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OCR timed out"));
    }, timeoutMilliseconds);
    work.then(resolvePromise, reject).finally(() => clearTimeout(timeout));
  });
}

/**
 * @description Runs the apply ocr fallback script step for local operations.
 * @param {{ readonly fileBytes: Buffer; readonly parsedPages: readonly ParsedDocumentPage[]; readonly env: ReturnType<typeof loadEnv>; readonly logger: Logger; }} input - Input value for input.
 * @returns {Promise<readonly ParsedDocumentPage[]>} Result of the apply ocr fallback operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
async function applyOcrFallback(input: {
  readonly fileBytes: Buffer;
  readonly parsedPages: readonly ParsedDocumentPage[];
  readonly env: ReturnType<typeof loadEnv>;
  readonly logger: Logger;
}): Promise<readonly ParsedDocumentPage[]> {
  const pagesRequiringOcr = input.parsedPages.filter(
    (page) =>
      !evaluateTextQuality(page.normalizedText, {
        minCharacters: input.env.DOCUMENT_TEXT_MIN_CHARACTERS,
        minWords: input.env.DOCUMENT_TEXT_MIN_WORDS,
        minPrintableRatio: input.env.DOCUMENT_TEXT_MIN_PRINTABLE_RATIO,
        maxIsolatedTokenRatio: input.env.DOCUMENT_TEXT_MAX_ISOLATED_TOKEN_RATIO,
      }).usable,
  );

  if (pagesRequiringOcr.length === 0) {
    return input.parsedPages;
  }

  const renderer = new PdfJsPageRendererAdapter();
  const tesseract: OcrProvider = new TesseractOcrAdapter();
  const replacedPages = new Map<number, ParsedDocumentPage>();
  const qualityConfig = {
    minCharacters: input.env.DOCUMENT_TEXT_MIN_CHARACTERS,
    minWords: input.env.DOCUMENT_TEXT_MIN_WORDS,
    minPrintableRatio: input.env.DOCUMENT_TEXT_MIN_PRINTABLE_RATIO,
    maxIsolatedTokenRatio: input.env.DOCUMENT_TEXT_MAX_ISOLATED_TOKEN_RATIO,
  };

  for (const page of pagesRequiringOcr) {
    const renderedPage = await renderer.renderPage({
      contractId: smokeContractId,
      documentId: smokeDocumentId,
      fileBytes: input.fileBytes,
      pageNumber: page.pageNumber,
      scale: input.env.OCR_RENDER_SCALE,
    });
    const result = await withTimeout(
      tesseract.extractPageText({
        contractId: smokeContractId,
        documentId: smokeDocumentId,
        pageNumber: page.pageNumber,
        fileBytes: input.fileBytes,
        pageImageBytes: renderedPage.imageBytes,
        pageImageMimeType: renderedPage.mimeType,
      }),
      input.env.OCR_TIMEOUT_MS,
    );
    const ocrPage = pageFromOcrResult(page, result, qualityConfig);
    const quality = evaluateTextQuality(ocrPage.normalizedText, qualityConfig);
    if (!quality.usable || result.confidence < input.env.OCR_MIN_CONFIDENCE) {
      throw new Error(`OCR output for page ${page.pageNumber} did not pass quality checks`);
    }
    input.logger.info("reference_aware_smoke_ocr_page_replaced", {
      pageNumber: page.pageNumber,
      provider: result.provider,
      confidence: result.confidence,
    });
    replacedPages.set(page.pageNumber, ocrPage);
  }

  return input.parsedPages.map((page) => replacedPages.get(page.pageNumber) ?? page);
}

/**
 * @description Runs the summary text script step for local operations.
 * @param {string | null | undefined} value - Input value for value.
 * @returns {string | null} Result of the summary text operation.
 */
function summaryText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

/**
 * @description Runs the summarize context script step for local operations.
 * @param {ContractContextExtractionResult} context - Input value for context.
 * @returns {unknown} Result of the summarize context operation.
 */
function summarizeContext(context: ContractContextExtractionResult) {
  return {
    parties: context.parties.map((party) => ({
      roleLabel: party.roleLabel,
      canonicalName: party.canonicalName,
      aliases: party.aliases,
      source: party.source,
      globalStartLine: party.sourceReference.globalStartLine,
      globalEndLine: party.sourceReference.globalEndLine,
    })),
    definedTerms: context.definedTerms.slice(0, 40).map((term) => ({
      term: term.term,
      definition: summaryText(term.definition),
      referencedSection: term.referencedSection,
      referencedExhibit: term.referencedExhibit,
      resolutionStatus: term.resolutionStatus,
      source: term.source,
      globalStartLine: term.sourceReference.globalStartLine,
      globalEndLine: term.sourceReference.globalEndLine,
    })),
    keyDates: context.keyDates.map((date) => ({
      label: date.label,
      rawValue: date.rawValue,
      normalizedValue: date.normalizedValue,
      source: date.source,
    })),
    rejectedItems: context.rejectedItems.map((item) => ({
      type: item.type,
      label: summaryText(item.label),
      startLine: item.startLine,
      endLine: item.endLine,
      errors: item.errors.map((error) => error.message),
    })),
  };
}

/**
 * @description Runs the summarize obligation script step for local operations.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @returns {unknown} Result of the summarize obligation operation.
 */
function summarizeObligation(obligation: SourceVerifiedOperationalObligation) {
  return {
    stableObligationId: obligation.stableObligationId,
    sourceCandidateKeys: obligation.sourceCandidateKeys,
    businessType: obligation.businessType,
    timingType: obligation.timingType,
    responsibleParty: {
      explicitText: obligation.responsibleParty.explicitText,
      roleLabel: obligation.responsibleParty.roleLabel,
      canonicalName: obligation.responsibleParty.canonicalName,
      resolutionMethod: obligation.responsibleParty.resolutionMethod,
    },
    counterparty: obligation.counterparty
      ? {
          explicitText: obligation.counterparty.explicitText,
          roleLabel: obligation.counterparty.roleLabel,
          canonicalName: obligation.counterparty.canonicalName,
          resolutionMethod: obligation.counterparty.resolutionMethod,
        }
      : null,
    action: obligation.action,
    object: obligation.object,
    summary: summaryText(obligation.summary),
    timing: {
      explicitDueDate: obligation.explicitDueDate,
      triggerEvent: obligation.triggerEvent,
      referenceDateLabel: obligation.referenceDateLabel,
      offsetValue: obligation.offsetValue,
      offsetUnit: obligation.offsetUnit,
      offsetDirection: obligation.offsetDirection,
      frequency: obligation.frequency,
      duration: obligation.duration,
    },
    referencedTerms: obligation.referencedTerms,
    crossReferences: obligation.crossReferences,
    sectionPath: obligation.sectionPath,
    sourceEvidence: obligation.sourceEvidence.map((span) => ({
      evidenceRole: span.evidenceRole,
      globalStartLine: span.globalStartLine,
      globalEndLine: span.globalEndLine,
      startPage: span.startPage,
      endPage: span.endPage,
      exactQuote: summaryText(span.exactQuote),
    })),
    confidence: obligation.confidence,
    reviewStatus: obligation.reviewStatus,
    reviewReasons: obligation.reviewReasons,
  };
}

/**
 * @description Runs the validate confirmed obligations script step for local operations.
 * @param {{ readonly obligations: readonly SourceVerifiedOperationalObligation[]; readonly sourceIndex: ContractSourceIndex; readonly windows: readonly DetectedCandidateWindow[]; }} input - Input value for input.
 * @returns {unknown} Result of the validate confirmed obligations operation.
 */
function validateConfirmedObligations(input: {
  readonly obligations: readonly SourceVerifiedOperationalObligation[];
  readonly sourceIndex: ContractSourceIndex;
  readonly windows: readonly DetectedCandidateWindow[];
}) {
  const failures: string[] = [];
  const windowByCandidateKey = new Map<string, DetectedCandidateWindow>();
  for (const window of input.windows) {
    for (const obligation of input.obligations) {
      for (const key of obligation.sourceCandidateKeys) {
        if (key.includes(window.id)) {
          windowByCandidateKey.set(key, window);
        }
      }
    }
  }

  for (const obligation of input.obligations) {
    const candidateWindows = obligation.sourceCandidateKeys.map(
      (key) => windowByCandidateKey.get(key) ?? null,
    );
    if (!candidateWindows.some((window) => window !== null)) {
      failures.push(`${obligation.stableObligationId}: originating candidate window is missing`);
    }
    if (obligation.reviewStatus !== "CONFIRMED") {
      failures.push(
        `${obligation.stableObligationId}: confirmed partition contains non-confirmed status`,
      );
    }
    if (!obligation.responsibleParty.canonicalName) {
      failures.push(`${obligation.stableObligationId}: responsible party is unresolved`);
    }
    if (!obligation.action.trim()) {
      failures.push(`${obligation.stableObligationId}: action is empty`);
    }
    if (!obligation.object.trim()) {
      failures.push(`${obligation.stableObligationId}: object is empty`);
    }
    if (obligation.reviewReasons.length > 0) {
      failures.push(`${obligation.stableObligationId}: confirmed obligation has review reasons`);
    }
    for (const span of obligation.sourceEvidence) {
      if (span.startPage < 1 || span.endPage < 1) {
        failures.push(`${obligation.stableObligationId}: evidence page is invalid`);
      }
      if (span.globalStartLine < 1 || span.globalEndLine < 1) {
        failures.push(`${obligation.stableObligationId}: evidence global line is invalid`);
      }
      if (span.globalStartLine > span.globalEndLine) {
        failures.push(`${obligation.stableObligationId}: evidence line range is reversed`);
      }
      const resolved = input.sourceIndex.resolveEvidenceSpan(
        span.globalStartLine,
        span.globalEndLine,
      );
      if (resolved.verificationErrors.length > 0) {
        failures.push(
          `${obligation.stableObligationId}: evidence source errors ${resolved.verificationErrors
            .map((error) => error.message)
            .join("; ")}`,
        );
      }
      if (resolved.exactQuote !== span.exactQuote) {
        failures.push(
          `${obligation.stableObligationId}: exact quote was not reconstructed from source`,
        );
      }
      if (
        !candidateWindows.some(
          (window) =>
            window !== null &&
            span.globalStartLine >= window.globalStartLine &&
            span.globalEndLine <= window.globalEndLine,
        )
      ) {
        failures.push(`${obligation.stableObligationId}: evidence is outside originating window`);
      }
      for (const sourceLine of resolved.sourceLines) {
        if (sourceLine.pageLocalLineNumber === null || sourceLine.pageLocalLineNumber < 1) {
          failures.push(`${obligation.stableObligationId}: page-local line is missing`);
        }
        if (sourceLine.pageNumber < 1) {
          failures.push(`${obligation.stableObligationId}: cited page is invalid`);
        }
      }
    }
  }

  return {
    passed: failures.length === 0,
    failureCount: failures.length,
    failures,
  };
}

/**
 * @description Runs the summarize payment example script step for local operations.
 * @param {readonly SourceVerifiedOperationalObligation[]} obligations - Input value for obligations.
 * @returns {unknown} Result of the summarize payment example operation.
 */
function summarizePaymentExample(obligations: readonly SourceVerifiedOperationalObligation[]) {
  const records = obligations
    .filter((obligation) =>
      /affiliate\s+(?:advertising|transactional)\s+share/i.test(obligation.object),
    )
    .map(summarizeObligation);

  return {
    foundAdvertisingShare: records.some((record) => /advertising/i.test(record.object)),
    foundTransactionalShare: records.some((record) => /transactional/i.test(record.object)),
    remainSeparate:
      new Set(records.map((record) => record.stableObligationId)).size === records.length,
    records,
  };
}

/**
 * @description Runs the assert required payment terms script step for local operations.
 * @param {readonly ParsedDocumentPage[]} pages - Input value for pages.
 * @returns {void} Result of the assert required payment terms operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function assertRequiredPaymentTerms(pages: readonly ParsedDocumentPage[]): void {
  const text = pages.map((page) => page.normalizedText).join("\n");
  const hasAdvertisingShare = /Affiliate Advertising Share/i.test(text);
  const hasTransactionalShare = /Affiliate Transactional Share/i.test(text);
  if (!hasAdvertisingShare || !hasTransactionalShare) {
    throw new Error("WRONG_CONTRACT_FIXTURE: required payment-share terms were not found");
  }
}

/**
 * @description Runs the normalized comparable script step for local operations.
 * @param {SmokeRunResult} run - Input value for run.
 * @returns {unknown} Result of the normalized comparable operation.
 */
function normalizedComparable(run: SmokeRunResult): unknown {
  return {
    context: run.context,
    metrics: {
      ...run.metrics,
    },
    confirmedObligations: [...run.confirmedObligations].sort((left, right) =>
      left.stableObligationId.localeCompare(right.stableObligationId),
    ),
    reviewRequired: [...run.reviewRequired].sort((left, right) =>
      left.stableObligationId.localeCompare(right.stableObligationId),
    ),
    rejected: [...run.rejected].sort((left, right) =>
      left.stableCandidateKey.localeCompare(right.stableCandidateKey),
    ),
    paymentExample: run.paymentExample,
    invariantValidation: run.invariantValidation,
  };
}

/**
 * @description Runs the hash comparable script step for local operations.
 * @param {unknown} value - Input value for value.
 * @returns {string} Result of the hash comparable operation.
 */
function hashComparable(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * @description Runs the build request plan script step for local operations.
 * @param {{ readonly selectedModelAlreadyCached: boolean; readonly batches: readonly CandidateWindowBatch[]; readonly maxRequestsPerContract: number; }} input - Input value for input.
 * @returns {unknown} Result of the build request plan operation.
 */
function buildRequestPlan(input: {
  readonly selectedModelAlreadyCached: boolean;
  readonly batches: readonly CandidateWindowBatch[];
  readonly maxRequestsPerContract: number;
}) {
  const modelListing = input.selectedModelAlreadyCached ? 0 : 1;
  const modelPreflight = input.selectedModelAlreadyCached ? 0 : 1;
  const contractContextExtraction = 1;
  const candidateExtraction = input.batches.length;
  const llmConsolidation = 0;
  const plannedRequests =
    modelListing +
    modelPreflight +
    contractContextExtraction +
    candidateExtraction +
    llmConsolidation;
  return {
    modelListing,
    modelPreflight,
    contractContextExtraction,
    candidateExtraction,
    llmConsolidation,
    plannedRequests,
    maxRequestsPerContract: input.maxRequestsPerContract,
    withinBudget: plannedRequests <= input.maxRequestsPerContract,
    candidateBatches: input.batches.map((batch) => ({
      batchId: batch.id,
      windowIds: batch.windows.map((window) => window.id),
      windowCount: batch.windows.length,
      estimatedInputCharacters: batch.estimatedInputCharacters,
    })),
  };
}

/**
 * @description Runs the run smoke once script step for local operations.
 * @param {{ readonly runIndex: number; readonly pdfPath: string; readonly env: ReturnType<typeof loadEnv>; }} input - Input value for input.
 * @returns {Promise<SmokeRunResult>} Result of the run smoke once operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
async function runSmokeOnce(input: {
  readonly runIndex: number;
  readonly pdfPath: string;
  readonly env: ReturnType<typeof loadEnv>;
}): Promise<SmokeRunResult> {
  const startedAt = Date.now();
  const logger = new SmokeLogger();
  const llm = new GeminiStructuredLlmClient({
    env: input.env,
    logger,
  });

  await llm.preflight();
  const preflightRequestCount = logger.countRequests();
  const fileBytes = await readFile(input.pdfPath);
  const parser = new NativePdfTextExtractorAdapter();
  const parsed = await parser.extract({
    contractId: smokeContractId,
    documentId: smokeDocumentId,
    storageKey: input.pdfPath,
    fileBytes,
    contentType: "application/pdf",
  });
  const processedPages = await applyOcrFallback({
    fileBytes,
    parsedPages: parsed.pages,
    env: input.env,
    logger,
  });
  assertRequiredPaymentTerms(processedPages);
  const segmentedPages = segmentDocumentPages(processedPages, {
    maxSegmentCharacters: input.env.DOCUMENT_SEGMENT_MAX_CHARACTERS,
    lineOverlap: input.env.DOCUMENT_SEGMENT_LINE_OVERLAP,
  });
  const sourceIndex = ContractSourceIndex.fromParsedPages(segmentedPages);
  if (sourceIndex.diagnostics.length > 0) {
    throw new Error(
      `Source index diagnostics failed: ${sourceIndex.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`,
    );
  }
  const windows = detectCandidateWindows(sourceIndex, {
    precedingContextLineCount: 1,
    followingContextLineCount: 1,
    maxWindowLineCount: 20,
    maxWindowCharacters: 6_000,
    mergeGapLineCount: 8,
  });
  const batches = buildCandidateWindowBatches(windows, {
    maxWindowsPerBatch: input.env.GEMINI_MAX_WINDOWS_PER_BATCH,
    maxBatchInputCharacters: input.env.GEMINI_MAX_BATCH_INPUT_CHARACTERS,
  });
  const requestPlan = buildRequestPlan({
    selectedModelAlreadyCached: preflightRequestCount === 0,
    batches,
    maxRequestsPerContract: input.env.GEMINI_MAX_REQUESTS_PER_CONTRACT,
  });
  if (!requestPlan.withinBudget) {
    throw new Error("GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED");
  }
  const contextExtractor = new ContractContextExtractor({ llm });
  const context = await contextExtractor.extract({
    sourceIndex,
    segments: segmentedPages.flatMap((page) => page.segments),
  });
  const candidateExtractor = new ObligationCandidateExtractor({
    llm,
    config: {
      maxWindowsPerBatch: input.env.GEMINI_MAX_WINDOWS_PER_BATCH,
      maxBatchInputCharacters: input.env.GEMINI_MAX_BATCH_INPUT_CHARACTERS,
      maxBatchOutputTokens: input.env.GEMINI_MAX_BATCH_OUTPUT_TOKENS,
    },
  });
  const verifier = new ObligationSourceVerifier({ confidenceThreshold: 0.7 });
  const deduplicator = new ObligationDeduplicator();
  const consolidator = new ObligationConsolidator();
  const rawCandidates: unknown[] = [];
  const extractorRejected: {
    readonly stableCandidateKey: string;
    readonly summary: string;
    readonly reviewReasons: readonly string[];
  }[] = [];
  const verificationItems: {
    readonly candidate: Awaited<
      ReturnType<ObligationCandidateExtractor["extract"]>
    >["verifiedCandidates"][number];
    readonly window: DetectedCandidateWindow;
  }[] = [];

  const extraction = await candidateExtractor.extract({
    sourceIndex,
    windows,
    context,
  });
  rawCandidates.push(...extraction.rawCandidates);
  extractorRejected.push(
    ...extraction.rejected.map((candidate) => ({
      stableCandidateKey: candidate.windowId,
      summary: summaryText(candidate.label) ?? "",
      reviewReasons: candidate.reasons.map((reason) => summaryText(reason) ?? ""),
    })),
  );
  verificationItems.push(
    ...extraction.verifiedCandidates.flatMap((candidate) => {
      const window = windows.find((item) => candidate.stableCandidateKey.includes(item.id));
      return window ? [{ candidate, window }] : [];
    }),
  );

  const sourceVerified = verifier.verify({
    sourceIndex,
    items: verificationItems,
  });
  const deduplicated = deduplicator.deduplicate(sourceVerified.verified);
  const consolidated = consolidator.consolidate(deduplicated);
  const confirmed = consolidated.filter((obligation) => obligation.reviewStatus === "CONFIRMED");
  const reviewRequired = consolidated.filter(
    (obligation) => obligation.reviewStatus === "REVIEW_REQUIRED",
  );
  const rejected = [
    ...extractorRejected,
    ...sourceVerified.rejected.map((candidate) => ({
      stableCandidateKey: candidate.stableCandidateKey,
      summary: summaryText(candidate.label) ?? "",
      reviewReasons: candidate.reviewReasons.map((reason) => summaryText(reason) ?? ""),
    })),
  ];
  const invariantValidation = validateConfirmedObligations({
    obligations: confirmed,
    sourceIndex,
    windows,
  });
  if (!invariantValidation.passed) {
    throw new Error(`Confirmed obligation invariant validation failed`);
  }

  return {
    runIndex: input.runIndex,
    preflightRequestCount,
    pageCount: processedPages.length,
    requiredPaymentTermsPresent: true,
    parsedPageCount: parsed.pages.length,
    ocrPageCount: processedPages.filter((page) => page.extractionMethod !== "PDF_TEXT").length,
    segmentCount: segmentedPages.reduce((count, page) => count + page.segments.length, 0),
    sourceLineCount: sourceIndex.lines.length,
    candidateWindowCount: windows.length,
    candidateBatchCount: batches.length,
    requestPlan,
    contractContextCallCount: logger.countRequests("contract_context_extraction"),
    obligationWindowCallCount: logger.countRequests("obligation_candidate_extraction"),
    totalGeminiRequestCount: logger.countRequests(),
    retryCount: llm.getMetricsSnapshot().retryCount,
    durationMilliseconds: Date.now() - startedAt,
    context: summarizeContext(context),
    metrics: {
      rawCandidates: rawCandidates.length,
      verifiedCandidates: sourceVerified.verified.length,
      confirmed: confirmed.length,
      reviewRequired: reviewRequired.length,
      rejected: rejected.length,
      duplicateRemovals: Math.max(0, sourceVerified.verified.length - deduplicated.length),
      consolidations: Math.max(0, deduplicated.length - consolidated.length),
    },
    confirmedObligations: confirmed.map(summarizeObligation),
    reviewRequired: reviewRequired.map(summarizeObligation),
    rejected,
    invariantValidation,
    paymentExample: summarizePaymentExample(confirmed),
  };
}

/**
 * @description Runs the main script step for local operations.
 * @returns {Promise<void>} Result of the main operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.pdfPath)) {
    throw new Error(`PDF not found: ${options.pdfPath}`);
  }
  if (extname(options.pdfPath).toLowerCase() !== ".pdf") {
    throw new Error(`PDF path must point to a .pdf file: ${options.pdfPath}`);
  }
  if (options.persist) {
    throw new Error(
      "Persistence mode is not implemented in this smoke script; use --persist false",
    );
  }
  const env = loadEnv();
  if (env.OBLIGATION_EXTRACTOR_MODE !== "reference-aware-gemini") {
    throw new Error("OBLIGATION_EXTRACTOR_MODE must be reference-aware-gemini for this smoke test");
  }
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for this smoke test");
  }

  await mkdir(options.outDir, { recursive: true });
  const runs: SmokeRunResult[] = [];
  for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
    runs.push(
      await runSmokeOnce({
        runIndex,
        pdfPath: options.pdfPath,
        env,
      }),
    );
  }

  const comparableHashes = runs.map((run) => hashComparable(normalizedComparable(run)));
  const idempotency =
    comparableHashes.length === 2
      ? {
          compared: true,
          matched: comparableHashes[0] === comparableHashes[1],
          firstHash: comparableHashes[0],
          secondHash: comparableHashes[1],
        }
      : {
          compared: false,
          matched: null,
          firstHash: comparableHashes[0] ?? null,
          secondHash: null,
        };
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      nodeEnv: env.NODE_ENV,
      extractorMode: env.OBLIGATION_EXTRACTOR_MODE,
      model: env.GEMINI_MODEL,
      requestTimeoutMilliseconds: env.GEMINI_REQUEST_TIMEOUT_MS,
      maxAttempts: env.GEMINI_MAX_ATTEMPTS,
      minRequestIntervalMilliseconds: env.GEMINI_MIN_REQUEST_INTERVAL_MS,
    },
    contract: {
      sanitizedFilename: basename(options.pdfPath),
      pdfPathHash: hashComparable(options.pdfPath),
      requiredPaymentTerms: ["Affiliate Advertising Share", "Affiliate Transactional Share"],
    },
    persistence: {
      attempted: false,
      reason:
        "Smoke script default is non-persisting; no isolated development database flag was used.",
    },
    runs,
    idempotency,
  };
  const outputPath = join(options.outDir, `reference-aware-smoke-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        model: env.GEMINI_MODEL,
        runs: runs.map((run) => ({
          runIndex: run.runIndex,
          pageCount: run.pageCount,
          requiredPaymentTermsPresent: run.requiredPaymentTermsPresent,
          ocrPageCount: run.ocrPageCount,
          candidateWindowCount: run.candidateWindowCount,
          totalGeminiRequestCount: run.totalGeminiRequestCount,
          retryCount: run.retryCount,
          metrics: run.metrics,
          invariantValidation: run.invariantValidation,
          paymentExample: {
            foundAdvertisingShare: run.paymentExample.foundAdvertisingShare,
            foundTransactionalShare: run.paymentExample.foundTransactionalShare,
            remainSeparate: run.paymentExample.remainSeparate,
          },
        })),
        idempotency,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      details: sanitizeValue(
        error && typeof error === "object" && "details" in error
          ? (error as { readonly details?: unknown }).details
          : undefined,
      ),
    }),
  );
  process.exitCode = 1;
});
