/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type { Logger } from "../../../config/logger.js";
import type {
  StructuredLlmClient,
  StructuredLlmMetricsProvider,
  StructuredLlmRequestBudgetProvider,
  StructuredLlmRequest,
} from "../../../infrastructure/llm/structured-llm-client.js";
import type { FieldAnchor, StructuredExtraction } from "../heuristics.js";
import type {
  ObligationExtractionInput,
  ObligationExtractionMetrics,
  ObligationExtractionProvider,
  ObligationExtractionResult,
  ObligationExtractionReviewCandidate,
} from "../obligation-extraction.provider.js";
import {
  detectCandidateWindows,
  type DetectedCandidateWindow,
} from "./candidate-window-detector.js";
import { ContractContextExtractor } from "./contract-context-extractor.js";
import { ObligationCandidateExtractor } from "./obligation-candidate-extractor.js";
import {
  ObligationConsolidator,
  ObligationDeduplicator,
  ObligationSourceVerifier,
  type SourceVerifiedOperationalObligation,
} from "./obligation-source-verification.js";
import type { EvidenceRole } from "./reference-aware-extraction.schemas.js";
import { ContractSourceIndex, type ContractSourceLineInput } from "./source-index.js";

export interface ReferenceAwareObligationExtractorConfig {
  readonly confidenceThreshold: number;
  readonly candidatePrecedingContextLineCount: number;
  readonly candidateFollowingContextLineCount: number;
  readonly candidateMaxWindowLineCount: number;
  readonly candidateMaxWindowCharacters: number;
  readonly candidateMergeGapLineCount: number;
  readonly maxWindowsPerBatch: number;
  readonly maxBatchInputCharacters: number;
  readonly maxBatchOutputTokens: number;
}

export interface ReferenceAwareObligationExtractorMetricsSnapshot {
  readonly llmRequestCount: number;
  readonly retryCount: number;
}

interface ReferenceAwareObligationExtractorDependencies {
  readonly llm: StructuredLlmClient;
  readonly logger: Logger;
  readonly config?: Partial<ReferenceAwareObligationExtractorConfig>;
}

const defaultConfig: ReferenceAwareObligationExtractorConfig = {
  confidenceThreshold: 0.7,
  candidatePrecedingContextLineCount: 1,
  candidateFollowingContextLineCount: 1,
  candidateMaxWindowLineCount: 20,
  candidateMaxWindowCharacters: 6_000,
  candidateMergeGapLineCount: 8,
  maxWindowsPerBatch: 4,
  maxBatchInputCharacters: 18_000,
  maxBatchOutputTokens: 6_000,
};

/**
 * @description Performs the normalize whitespace helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string} Result of the normalize whitespace operation.
 */
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * @description Performs the stable summary helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string} Result of the stable summary operation.
 */
function stableSummary(value: string): string {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

/**
 * @description Performs the source lines from legacy pages helper operation for this module.
 * @param {ObligationExtractionInput} input - Input value for input.
 * @returns {readonly ContractSourceLineInput[]} Result of the source lines from legacy pages operation.
 */
function sourceLinesFromLegacyPages(
  input: ObligationExtractionInput,
): readonly ContractSourceLineInput[] {
  const lines: ContractSourceLineInput[] = [];
  let globalLineNumber = 1;

  for (const page of [...input.pages].sort((left, right) => left.pageNumber - right.pageNumber)) {
    const pageLines = page.rawText
      .split(/\r?\n/)
      .map(normalizeWhitespace)
      .filter((line) => line.length > 0);

    for (const [index, text] of pageLines.entries()) {
      lines.push({
        globalLineNumber,
        pageNumber: page.pageNumber,
        pageLocalLineNumber: index + 1,
        text,
        sourceMethod: "PDF_TEXT",
      });
      globalLineNumber += 1;
    }
  }

  return lines;
}

/**
 * @description Performs the build source index helper operation for this module.
 * @param {ObligationExtractionInput} input - Input value for input.
 * @returns {ContractSourceIndex} Result of the build source index operation.
 */
function buildSourceIndex(input: ObligationExtractionInput): ContractSourceIndex {
  if (input.segmentedPages && input.segmentedPages.length > 0) {
    return ContractSourceIndex.fromParsedPages(input.segmentedPages);
  }
  return new ContractSourceIndex(sourceLinesFromLegacyPages(input));
}

/**
 * @description Performs the first evidence helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @param {EvidenceRole} role - Input value for role.
 * @returns {SourceVerifiedOperationalObligation["sourceEvidence"][number] | undefined} Result of the first evidence operation.
 */
function firstEvidence(
  obligation: SourceVerifiedOperationalObligation,
  role: EvidenceRole,
): SourceVerifiedOperationalObligation["sourceEvidence"][number] | undefined {
  return (
    obligation.sourceEvidence.find((span) => span.evidenceRole === role) ??
    obligation.sourceEvidence[0]
  );
}

/**
 * @description Performs the to timing helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @returns {Record<string, unknown>} Result of the to timing operation.
 */
function toTiming(obligation: SourceVerifiedOperationalObligation): Record<string, unknown> {
  return {
    explicitDueDate: obligation.explicitDueDate,
    triggerEvent: obligation.triggerEvent,
    referenceDateLabel: obligation.referenceDateLabel,
    offsetValue: obligation.offsetValue,
    offsetUnit: obligation.offsetUnit,
    offsetDirection: obligation.offsetDirection,
    frequency: obligation.frequency,
    duration: obligation.duration,
    timingType: obligation.timingType,
  };
}

/**
 * @description Performs the to source evidence records helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @returns {readonly Record<string, unknown>[]} Result of the to source evidence records operation.
 */
function toSourceEvidenceRecords(
  obligation: SourceVerifiedOperationalObligation,
  sourceIndex: ContractSourceIndex,
): readonly Record<string, unknown>[] {
  return obligation.sourceEvidence.map((span) => {
    const startLine = sourceIndex.getLine(span.globalStartLine);
    const endLine = sourceIndex.getLine(span.globalEndLine);
    return {
      evidenceRole: span.evidenceRole,
      globalStartLine: span.globalStartLine,
      globalEndLine: span.globalEndLine,
      startPage: span.startPage,
      endPage: span.endPage,
      startLine: startLine?.pageLocalLineNumber ?? span.globalStartLine,
      endLine: endLine?.pageLocalLineNumber ?? span.globalEndLine,
      exactQuote: span.exactQuote,
    };
  });
}

/**
 * @description Performs the to field anchor helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @returns {FieldAnchor} Result of the to field anchor operation.
 */
function toFieldAnchor(
  obligation: SourceVerifiedOperationalObligation,
  sourceIndex: ContractSourceIndex,
): FieldAnchor {
  const primaryEvidence = firstEvidence(obligation, "ACTION");
  const primaryLine = primaryEvidence ? sourceIndex.getLine(primaryEvidence.globalStartLine) : null;
  const endLine = primaryEvidence ? sourceIndex.getLine(primaryEvidence.globalEndLine) : null;
  const startLineNumber = primaryLine?.pageLocalLineNumber ?? primaryLine?.globalLineNumber ?? 1;
  const endLineNumber =
    endLine?.pageLocalLineNumber ?? endLine?.globalLineNumber ?? startLineNumber;

  return {
    text: obligation.summary,
    anchor: {
      page_number: primaryEvidence?.startPage ?? primaryLine?.pageNumber ?? 1,
      line_offset: Math.max(0, startLineNumber - 1),
      quoted_text: primaryEvidence?.exactQuote ?? obligation.summary,
      start_line: startLineNumber,
      end_line: endLineNumber,
      source: "reference_aware_obligation",
      obligation_type: obligation.businessType,
      obligated_party: obligation.responsibleParty.canonicalName,
      beneficiary_party: obligation.counterparty?.canonicalName ?? null,
      action: obligation.action,
      deliverable: obligation.object,
      timing: toTiming(obligation),
      conditions: obligation.triggerEvent ? [obligation.triggerEvent] : [],
      exceptions: [],
      financial_terms: {},
      consequence: null,
      penalty: null,
      confidence: {
        overall: obligation.confidence,
        reviewStatus: obligation.reviewStatus,
      },
      warnings: obligation.reviewReasons,
      missing_fields: [],
      source_evidence: toSourceEvidenceRecords(obligation, sourceIndex),
      source_candidate_keys: obligation.sourceCandidateKeys,
    },
  };
}

/**
 * @description Performs the average confidence helper operation for this module.
 * @param {readonly SourceVerifiedOperationalObligation[]} obligations - Input value for obligations.
 * @returns {number} Result of the average confidence operation.
 */
function averageConfidence(obligations: readonly SourceVerifiedOperationalObligation[]): number {
  if (obligations.length === 0) {
    return 0.75;
  }
  const average =
    obligations.reduce((total, obligation) => total + obligation.confidence, 0) /
    obligations.length;
  return Number(average.toFixed(3));
}

/**
 * @description Performs the review candidate helper operation for this module.
 * @param {{ readonly stableCandidateKey: string; readonly summary: string; readonly reviewReasons: readonly string[]; readonly sourceReferences?: ObligationExtractionReviewCandidate["sourceReferences"]; }} input - Input value for input.
 * @returns {ObligationExtractionReviewCandidate} Result of the review candidate operation.
 */
function reviewCandidate(input: {
  readonly stableCandidateKey: string;
  readonly summary: string;
  readonly reviewReasons: readonly string[];
  readonly sourceReferences?: ObligationExtractionReviewCandidate["sourceReferences"];
}): ObligationExtractionReviewCandidate {
  return {
    stableCandidateKey: input.stableCandidateKey,
    summary: stableSummary(input.summary),
    reviewReasons: input.reviewReasons.map(stableSummary),
    ...(input.sourceReferences ? { sourceReferences: input.sourceReferences } : {}),
  };
}

/**
 * @description Performs the source references for review helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @returns {ObligationExtractionReviewCandidate["sourceReferences"]} Result of the source references for review operation.
 */
function sourceReferencesForReview(
  obligation: SourceVerifiedOperationalObligation,
  sourceIndex: ContractSourceIndex,
): ObligationExtractionReviewCandidate["sourceReferences"] {
  const seen = new Set<string>();
  const sourceReferences: {
    pageNumber: number;
    startLine: number;
    endLine: number;
    globalStartLine: number;
    globalEndLine: number;
  }[] = [];

  for (const span of obligation.sourceEvidence) {
    const startLine = sourceIndex.getLine(span.globalStartLine);
    const endLine = sourceIndex.getLine(span.globalEndLine);
    const reference = {
      pageNumber: span.startPage,
      startLine: startLine?.pageLocalLineNumber ?? span.globalStartLine,
      endLine: endLine?.pageLocalLineNumber ?? span.globalEndLine,
      globalStartLine: span.globalStartLine,
      globalEndLine: span.globalEndLine,
    };
    const key = `${reference.pageNumber}:${reference.startLine}:${reference.endLine}:${reference.globalStartLine}:${reference.globalEndLine}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sourceReferences.push(reference);
  }

  return sourceReferences;
}

/**
 * @description Executes the get structured llm metrics provider operation used by the application workflow.
 * @param {StructuredLlmClient} client - Input value for client.
 * @returns {StructuredLlmMetricsProvider | null} Result of the get structured llm metrics provider operation.
 */
function getStructuredLlmMetricsProvider(
  client: StructuredLlmClient,
): StructuredLlmMetricsProvider | null {
  const candidate = client as Partial<StructuredLlmMetricsProvider>;
  return typeof candidate.getMetricsSnapshot === "function"
    ? (candidate as StructuredLlmMetricsProvider)
    : null;
}

/**
 * @description Executes the get structured llm request budget provider operation used by the application workflow.
 * @param {StructuredLlmClient} client - Input value for client.
 * @returns {StructuredLlmRequestBudgetProvider | null} Result of the get structured llm request budget provider operation.
 */
function getStructuredLlmRequestBudgetProvider(
  client: StructuredLlmClient,
): StructuredLlmRequestBudgetProvider | null {
  const candidate = client as Partial<StructuredLlmRequestBudgetProvider>;
  return typeof candidate.resetRequestBudgetScope === "function"
    ? (candidate as StructuredLlmRequestBudgetProvider)
    : null;
}

class CountingStructuredLlmClient implements StructuredLlmClient {
  private requestCount = 0;
  private retryCount = 0;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {StructuredLlmClient} delegate - Input value for delegate.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly delegate: StructuredLlmClient) {}

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {StructuredLlmRequest<T>} request - Input value for request.
   * @returns {Promise<T>} Result of the generate structured operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T> {
    this.requestCount += 1;
    try {
      return await this.delegate.generateStructured(request);
    } catch (error) {
      const attempts = (error as { readonly details?: { readonly attempts?: unknown } }).details
        ?.attempts;
      if (typeof attempts === "number" && attempts > 1) {
        this.retryCount += attempts - 1;
      }
      throw error;
    }
  }

  /**
   * @description Implements the snapshot method for this service or adapter.
   * @returns {ReferenceAwareObligationExtractorMetricsSnapshot} Result of the snapshot operation.
   */
  snapshot(): ReferenceAwareObligationExtractorMetricsSnapshot {
    const providerMetrics = getStructuredLlmMetricsProvider(this.delegate)?.getMetricsSnapshot();
    return {
      llmRequestCount: this.requestCount,
      retryCount: (providerMetrics?.retryCount ?? 0) + this.retryCount,
    };
  }

  /**
   * @description Implements the reset request budget scope method for this service or adapter.
   * @returns {void} Result of the reset request budget scope operation.
   */
  resetRequestBudgetScope(): void {
    this.requestCount = 0;
    this.retryCount = 0;
    getStructuredLlmRequestBudgetProvider(this.delegate)?.resetRequestBudgetScope();
  }
}

export class ReferenceAwareObligationExtractor implements ObligationExtractionProvider {
  private readonly llm: CountingStructuredLlmClient;
  private readonly contextExtractor: ContractContextExtractor;
  private readonly candidateExtractor: ObligationCandidateExtractor;
  private readonly sourceVerifier: ObligationSourceVerifier;
  private readonly deduplicator = new ObligationDeduplicator();
  private readonly consolidator = new ObligationConsolidator();
  private readonly config: ReferenceAwareObligationExtractorConfig;
  private readonly logger: Logger;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReferenceAwareObligationExtractorDependencies} dependencies - Input value for dependencies.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(dependencies: ReferenceAwareObligationExtractorDependencies) {
    const config = { ...defaultConfig, ...dependencies.config };
    this.config = config;
    this.llm = new CountingStructuredLlmClient(dependencies.llm);
    this.contextExtractor = new ContractContextExtractor({ llm: this.llm });
    this.candidateExtractor = new ObligationCandidateExtractor({
      llm: this.llm,
      config: {
        lowConfidenceThreshold: config.confidenceThreshold,
        maxWindowsPerBatch: config.maxWindowsPerBatch,
        maxBatchInputCharacters: config.maxBatchInputCharacters,
        maxBatchOutputTokens: config.maxBatchOutputTokens,
      },
    });
    this.sourceVerifier = new ObligationSourceVerifier({
      confidenceThreshold: config.confidenceThreshold,
    });
    this.logger = dependencies.logger;
  }

  /**
   * @description Implements the extract method for this service or adapter.
   * @param {ObligationExtractionInput} input - Input value for input.
   * @returns {Promise<ObligationExtractionResult>} Result of the extract operation.
   */
  async extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult> {
    const startedAt = Date.now();
    this.llm.resetRequestBudgetScope();
    const initialLlmMetrics = this.llm.snapshot();
    const sourceIndex = buildSourceIndex(input);
    const windows = detectCandidateWindows(sourceIndex, {
      precedingContextLineCount: this.config.candidatePrecedingContextLineCount,
      followingContextLineCount: this.config.candidateFollowingContextLineCount,
      maxWindowLineCount: this.config.candidateMaxWindowLineCount,
      maxWindowCharacters: this.config.candidateMaxWindowCharacters,
      mergeGapLineCount: this.config.candidateMergeGapLineCount,
    });
    const context = await this.contextExtractor.extract({
      sourceIndex,
      ...(input.segmentedPages
        ? { segments: input.segmentedPages.flatMap((page) => page.segments) }
        : {}),
    });
    const allRawCandidates: unknown[] = [];
    const allExtractorRejected: ObligationExtractionReviewCandidate[] = [];
    const verificationItems: {
      readonly candidate: Awaited<
        ReturnType<ObligationCandidateExtractor["extract"]>
      >["verifiedCandidates"][number];
      readonly window: DetectedCandidateWindow;
    }[] = [];

    const windowByCandidateKey = new Map<string, DetectedCandidateWindow>();
    const result = await this.candidateExtractor.extract({
      sourceIndex,
      windows,
      context,
    });
    allRawCandidates.push(...result.rawCandidates);
    allExtractorRejected.push(
      ...result.rejected.map((candidate) =>
        reviewCandidate({
          stableCandidateKey: candidate.windowId,
          summary: candidate.label,
          reviewReasons: candidate.reasons,
        }),
      ),
    );
    for (const window of windows) {
      for (const candidate of result.verifiedCandidates) {
        if (candidate.stableCandidateKey.includes(window.id)) {
          windowByCandidateKey.set(candidate.stableCandidateKey, window);
        }
      }
    }
    verificationItems.push(
      ...result.verifiedCandidates.map((candidate) => ({
        candidate,
        window:
          windowByCandidateKey.get(candidate.stableCandidateKey) ??
          windows[0] ??
          ({
            id: "missing_window",
            globalStartLine: 1,
            globalEndLine: 1,
            targetGlobalLines: [],
            contextSpans: [],
            targetSpans: [],
            sectionPath: [],
            cueTypes: [],
            characterCount: 0,
            sourceMethod: "PDF_TEXT",
            sourceLines: [],
          } satisfies DetectedCandidateWindow),
      })),
    );

    const sourceVerified = this.sourceVerifier.verify({
      sourceIndex,
      items: verificationItems,
    });
    const deduplicated = this.deduplicator.deduplicate(sourceVerified.verified);
    const consolidated = this.consolidator.consolidate(deduplicated);
    const confirmed = consolidated.filter((obligation) => obligation.reviewStatus === "CONFIRMED");
    const reviewRequired = consolidated.filter(
      (obligation) => obligation.reviewStatus === "REVIEW_REQUIRED",
    );
    const metrics: ObligationExtractionMetrics = {
      candidateWindows: windows.length,
      rawCandidates: allRawCandidates.length,
      confirmed: confirmed.length,
      reviewRequired: reviewRequired.length,
      rejected: allExtractorRejected.length + sourceVerified.rejected.length,
      duplicateRemovals: Math.max(0, sourceVerified.verified.length - deduplicated.length),
      consolidations: Math.max(0, deduplicated.length - consolidated.length),
      llmRequestCount: this.llm.snapshot().llmRequestCount - initialLlmMetrics.llmRequestCount,
      retryCount: this.llm.snapshot().retryCount - initialLlmMetrics.retryCount,
      extractionDurationMilliseconds: Date.now() - startedAt,
    };
    const extraction: StructuredExtraction = {
      obligations: confirmed.map((obligation) => toFieldAnchor(obligation, sourceIndex)),
    };

    this.logger.info("reference_aware_obligations_extracted", {
      contractId: input.context.contractId,
      documentId: input.context.documentId,
      processingRunId: input.context.processingRunId,
      metrics,
    });

    return {
      extraction,
      confidence: averageConfidence(confirmed),
      provider: "REFERENCE_AWARE_GEMINI",
      metadata: {
        metrics,
        reviewRequiredCandidates: reviewRequired.map((obligation) =>
          reviewCandidate({
            stableCandidateKey: obligation.stableObligationId,
            summary: obligation.summary,
            reviewReasons: obligation.reviewReasons,
            sourceReferences: sourceReferencesForReview(obligation, sourceIndex),
          }),
        ),
        rejectedCandidates: [
          ...allExtractorRejected,
          ...sourceVerified.rejected.map((candidate) =>
            reviewCandidate({
              stableCandidateKey: candidate.stableCandidateKey,
              summary: candidate.label,
              reviewReasons: candidate.reviewReasons,
            }),
          ),
        ],
      },
    };
  }
}
