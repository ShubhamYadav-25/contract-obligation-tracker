/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import { z } from "zod";

import type { Logger } from "../../config/logger.js";
import type { LlmProvider } from "../../infrastructure/llm/llm-provider.js";
import type { SegmentedDocumentPage } from "../document-processing/document-processing.types.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import {
  extractFieldsFromPages,
  type FieldAnchor,
  type Page,
  type StructuredExtraction,
} from "./heuristics.js";

export type ObligationExtractionContext = {
  readonly organizationId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
};

export type ObligationExtractionInput = {
  readonly pages: readonly Page[];
  readonly segmentedPages?: readonly SegmentedDocumentPage[];
  readonly context: ObligationExtractionContext;
};

export type ObligationExtractionMetrics = {
  readonly candidateWindows: number;
  readonly rawCandidates: number;
  readonly confirmed: number;
  readonly reviewRequired: number;
  readonly rejected: number;
  readonly duplicateRemovals: number;
  readonly consolidations: number;
  readonly llmRequestCount: number;
  readonly retryCount: number;
  readonly extractionDurationMilliseconds: number;
};

export type ObligationExtractionReviewCandidate = {
  readonly stableCandidateKey: string;
  readonly summary: string;
  readonly reviewReasons: readonly string[];
  readonly sourceReferences?: readonly {
    readonly pageNumber: number;
    readonly startLine: number;
    readonly endLine: number;
    readonly globalStartLine?: number;
    readonly globalEndLine?: number;
  }[];
};

export type ObligationExtractionMetadata = {
  readonly metrics?: ObligationExtractionMetrics;
  readonly reviewRequiredCandidates?: readonly ObligationExtractionReviewCandidate[];
  readonly rejectedCandidates?: readonly ObligationExtractionReviewCandidate[];
};

export type ObligationExtractionResult = {
  readonly extraction: StructuredExtraction;
  readonly confidence: number;
  readonly provider: "HEURISTIC" | "GROQ" | "REFERENCE_AWARE_GEMINI";
  readonly metadata?: ObligationExtractionMetadata;
};

export interface ObligationExtractionProvider {
  extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult>;
}

type TriggeredFallbackDependencies = {
  readonly primary: ObligationExtractionProvider;
  readonly fallback: ObligationExtractionProvider;
  readonly shouldFallback: (error: unknown) => boolean;
  readonly logger: Logger;
};

export class TriggeredFallbackObligationExtractionProvider
  implements ObligationExtractionProvider
{
  constructor(private readonly dependencies: TriggeredFallbackDependencies) {}

  async extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult> {
    try {
      return await this.dependencies.primary.extract(input);
    } catch (error) {
      if (!this.dependencies.shouldFallback(error)) {
        throw error;
      }

      this.dependencies.logger.warn("obligation_extraction_fallback_triggered", {
        contractId: input.context.contractId,
        documentId: input.context.documentId,
        processingRunId: input.context.processingRunId,
        primaryProvider: "REFERENCE_AWARE_GEMINI",
        fallbackProvider: "GROQ",
        reason: error instanceof Error ? error.message : String(error),
      });
      return this.dependencies.fallback.extract(input);
    }
  }
}

export class HeuristicObligationExtractionProvider implements ObligationExtractionProvider {
  /**
   * @description Implements the extract method for this service or adapter.
   * @param {ObligationExtractionInput} input - Input value for input.
   * @returns {Promise<ObligationExtractionResult>} Result of the extract operation.
   */
  async extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult> {
    const result = extractFieldsFromPages([...input.pages]);
    return {
      ...result,
      provider: "HEURISTIC",
    };
  }
}

export type GroqObligationExtractionConfig = {
  readonly model: string;
  readonly timeoutMilliseconds: number;
  readonly maxAttempts: number;
  readonly retryBaseDelayMilliseconds: number;
  readonly retryMaxDelayMilliseconds: number;
};

type GroqObligationExtractionDependencies = {
  readonly llm: LlmProvider;
  readonly fallback: ObligationExtractionProvider;
  readonly logger: Logger;
  readonly config: GroqObligationExtractionConfig;
};

const groqObligationSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  obligationType: z.string().trim().min(1),
  obligatedParty: z.string().trim().min(1).nullable(),
  beneficiaryParty: z.string().trim().min(1).nullable(),
  action: z.string().trim().min(1),
  deliverable: z.string().trim().min(1).nullable(),
  timing: z.object({
    explicitDueDate: z.string().trim().min(1).nullable(),
    triggerEvent: z.string().trim().min(1).nullable(),
    triggerDate: z.string().trim().min(1).nullable(),
    offsetValue: z.number().nullable(),
    offsetUnit: z.enum(["HOURS", "CALENDAR_DAYS", "BUSINESS_DAYS", "WEEKS", "MONTHS"]).nullable(),
    offsetDirection: z.enum(["BEFORE", "AFTER"]).nullable(),
    recurrenceFrequency: z
      .enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"])
      .nullable(),
    recurrenceInterval: z.number().nullable(),
    gracePeriodDays: z.number().nullable(),
  }),
  conditions: z.array(z.string()),
  exceptions: z.array(z.string()),
  financialTerms: z.object({
    amount: z.string().trim().min(1).nullable(),
    currency: z.string().trim().min(1).nullable(),
    percentage: z.string().trim().min(1).nullable(),
    calculationBasis: z.string().trim().min(1).nullable(),
  }),
  consequence: z.string().trim().min(1).nullable(),
  penalty: z.string().trim().min(1).nullable(),
  sourceAnchors: z
    .array(
      z.object({
        pageNumber: z.number().int(),
        lineStart: z.number().int(),
        lineEnd: z.number().int(),
        startOffset: z.number().int(),
        endOffset: z.number().int(),
        sourceText: z.string().trim().min(1),
      }),
    )
    .min(1),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    obligatedParty: z.number().min(0).max(1),
    action: z.number().min(0).max(1),
    timing: z.number().min(0).max(1),
    sourceAnchor: z.number().min(0).max(1),
  }),
  warnings: z.array(z.string()),
  missingFields: z.array(z.string()),
});

const groqResponseSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { obligations: value } : value),
  z.object({
    obligations: z.array(groqObligationSchema).default([]),
  }),
);

type GroqObligation = z.infer<typeof groqObligationSchema>;

type NumberedPage = {
  readonly pageNumber: number;
  readonly rawText: string;
  readonly lines: readonly {
    readonly number: number;
    readonly text: string;
    readonly startOffset: number;
    readonly endOffset: number;
  }[];
};

type NumberedLine = NumberedPage["lines"][number] & {
  readonly pageNumber: number;
};

const maxGroqSourceCharacters = 6_500;
const maxGroqSourceLines = 90;
const obligationCandidatePattern =
  /\b(shall|must|will|is required to|are required to|agrees? to|covenants?|obligat(?:e|ed|ion|ions)|responsible for|pay(?:ment)?|invoice|deliver(?:y)?|provide|maintain|submit|report|notice|notify|renew(?:al)?|terminat(?:e|ion)|expir(?:e|ation)|comply|compliance|confidential|insurance|indemnif|audit|service level|sla)\b/i;
const timingOrMoneyPattern =
  /\b(\d+\s*(?:day|days|month|months|year|years)|within\s+\d+|by\s+\d{1,2}\/\d{1,2}\/\d{2,4}|[$£€]\s*\d)/i;

/**
 * @description Performs the normalize whitespace helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string} Result of the normalize whitespace operation.
 */
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * @description Performs the to numbered pages helper operation for this module.
 * @param {readonly Page[]} pages - Input value for pages.
 * @returns {readonly NumberedPage[]} Result of the to numbered pages operation.
 */
function toNumberedPages(pages: readonly Page[]): readonly NumberedPage[] {
  return pages.map((page) => {
    const lines: {
      readonly number: number;
      readonly text: string;
      readonly startOffset: number;
      readonly endOffset: number;
    }[] = [];
    const matches = page.rawText.matchAll(/[^\r\n]+/g);

    for (const match of matches) {
      const rawLine = match[0];
      const leadingWhitespaceLength = rawLine.length - rawLine.trimStart().length;
      const text = rawLine.trim();
      if (!text) continue;

      const startOffset = (match.index ?? 0) + leadingWhitespaceLength;
      lines.push({
        number: lines.length + 1,
        text,
        startOffset,
        endOffset: startOffset + text.length,
      });
    }

    return {
      pageNumber: page.pageNumber,
      rawText: page.rawText,
      lines,
    };
  });
}

/**
 * @description Performs the score line helper operation for this module.
 * @param {NumberedLine} line - Input value for line.
 * @returns {number} Result of the score line operation.
 */
function scoreLine(line: NumberedLine): number {
  let score = 0;
  if (obligationCandidatePattern.test(line.text)) {
    score += 10;
  }
  if (timingOrMoneyPattern.test(line.text)) {
    score += 3;
  }
  if (/\b(section|article|clause|schedule)\b/i.test(line.text)) {
    score += 1;
  }
  if (line.text.length > 350) {
    score -= 2;
  }
  return score;
}

/**
 * @description Performs the line prompt cost helper operation for this module.
 * @param {NumberedLine} line - Input value for line.
 * @returns {number} Result of the line prompt cost operation.
 */
function linePromptCost(line: NumberedLine): number {
  return line.text.length + 72;
}

/**
 * @description Performs the select groq prompt pages helper operation for this module.
 * @param {readonly NumberedPage[]} pages - Input value for pages.
 * @returns {readonly NumberedPage[]} Result of the select groq prompt pages operation.
 */
function selectGroqPromptPages(pages: readonly NumberedPage[]): readonly NumberedPage[] {
  const allLines = pages.flatMap((page) =>
    page.lines.map((line) => ({
      ...line,
      pageNumber: page.pageNumber,
    })),
  );
  const scoredLines = allLines
    .map((line) => ({ line, score: scoreLine(line) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.line.pageNumber !== right.line.pageNumber) {
        return left.line.pageNumber - right.line.pageNumber;
      }
      return left.line.number - right.line.number;
    });

  const selected = new Map<string, NumberedLine>();
  let sourceCharacters = 0;

  /**
   * @description Performs the try select helper operation for this module.
   * @param {NumberedLine | undefined} line - Input value for line.
   * @returns {void} Result of the try select operation.
   */
  function trySelect(line: NumberedLine | undefined): void {
    if (!line || selected.size >= maxGroqSourceLines) {
      return;
    }
    const key = `${line.pageNumber}:${line.number}`;
    if (selected.has(key)) {
      return;
    }
    const cost = linePromptCost(line);
    if (sourceCharacters + cost > maxGroqSourceCharacters) {
      return;
    }
    selected.set(key, line);
    sourceCharacters += cost;
  }

  for (const candidate of scoredLines) {
    const page = pages.find((item) => item.pageNumber === candidate.line.pageNumber);
    const previousLine = page?.lines[candidate.line.number - 2];
    const nextLine = page?.lines[candidate.line.number];
    trySelect(
      previousLine
        ? {
            ...previousLine,
            pageNumber: candidate.line.pageNumber,
          }
        : undefined,
    );
    trySelect(candidate.line);
    trySelect(
      nextLine
        ? {
            ...nextLine,
            pageNumber: candidate.line.pageNumber,
          }
        : undefined,
    );
  }

  if (selected.size === 0) {
    for (const line of allLines) {
      trySelect(line);
    }
  }

  const linesByPage = new Map<number, NumberedLine[]>();
  for (const line of [...selected.values()].sort((left, right) => {
    if (left.pageNumber !== right.pageNumber) {
      return left.pageNumber - right.pageNumber;
    }
    return left.number - right.number;
  })) {
    const lines = linesByPage.get(line.pageNumber) ?? [];
    lines.push(line);
    linesByPage.set(line.pageNumber, lines);
  }

  return pages
    .map((page) => ({
      ...page,
      lines: linesByPage.get(page.pageNumber) ?? [],
    }))
    .filter((page) => page.lines.length > 0);
}

/**
 * @description Performs the build prompt helper operation for this module.
 * @param {readonly NumberedPage[]} pages - Input value for pages.
 * @returns {string} Result of the build prompt operation.
 */
function buildPrompt(pages: readonly NumberedPage[]): string {
  const pageText = pages
    .map((page) => {
      const lines = page.lines
        .map(
          (line) =>
            `L${line.number} [startOffset=${line.startOffset}, endOffset=${line.endOffset}]: ${line.text}`,
        )
        .join("\n");
      return `Page ${page.pageNumber}\n${lines}`;
    })
    .join("\n\n");

  return [
    "Extract actionable contract obligations from the supplied candidate lines.",
    "",
    "Return JSON only: an array of objects with title, description, obligationType, obligatedParty, beneficiaryParty, action, deliverable, timing, conditions, exceptions, financialTerms, consequence, penalty, sourceAnchors, confidence, warnings, missingFields.",
    "Required nested keys: timing has explicitDueDate, triggerEvent, triggerDate, offsetValue, offsetUnit, offsetDirection, recurrenceFrequency, recurrenceInterval, gracePeriodDays. financialTerms has amount, currency, percentage, calculationBasis. confidence has overall, obligatedParty, action, timing, sourceAnchor.",
    "Use null for unknown scalar values and [] for empty arrays.",
    "sourceAnchors must include pageNumber, lineStart, lineEnd, startOffset, endOffset, sourceText. sourceText must be an exact verbatim substring from the supplied lines.",
    "If there are no obligations, return [].",
    "",
    pageText,
  ].join("\n");
}

/**
 * @description Performs the is retryable error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {boolean} Result of the is retryable error operation.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApplicationError) {
    return error.details.retryable === true;
  }
  return true;
}

/**
 * @description Performs the error details helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {Record<string, unknown> | undefined} Result of the error details operation.
 */
function errorDetails(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof ApplicationError) {
    return error.details;
  }
  return undefined;
}

/**
 * @description Performs the delay helper operation for this module.
 * @param {number} milliseconds - Input value for milliseconds.
 * @returns {Promise<void>} Result of the delay operation.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * @description Performs the to retry delay helper operation for this module.
 * @param {number} attemptIndex - Input value for attempt index.
 * @param {GroqObligationExtractionConfig} config - Input value for config.
 * @returns {number} Result of the to retry delay operation.
 */
function toRetryDelay(attemptIndex: number, config: GroqObligationExtractionConfig): number {
  const computed = config.retryBaseDelayMilliseconds * 2 ** attemptIndex;
  return Math.min(computed, config.retryMaxDelayMilliseconds);
}

/**
 * @description Performs the verify obligation helper operation for this module.
 * @param {GroqObligation} obligation - Input value for obligation.
 * @param {ReadonlyMap<number, NumberedPage>} pagesByNumber - Input value for pages by number.
 * @returns {FieldAnchor | null} Result of the verify obligation operation.
 */
function verifyObligation(
  obligation: GroqObligation,
  pagesByNumber: ReadonlyMap<number, NumberedPage>,
): FieldAnchor | null {
  const primaryAnchor = obligation.sourceAnchors[0];
  if (!primaryAnchor) {
    return null;
  }

  const page = pagesByNumber.get(primaryAnchor.pageNumber);
  if (!page) {
    return null;
  }
  if (primaryAnchor.lineStart > primaryAnchor.lineEnd) {
    return null;
  }
  if (primaryAnchor.lineStart < 1 || primaryAnchor.lineEnd > page.lines.length) {
    return null;
  }

  const selectedText = page.lines
    .slice(primaryAnchor.lineStart - 1, primaryAnchor.lineEnd)
    .map((line) => line.text)
    .join(" ");
  if (!normalizeWhitespace(selectedText).includes(normalizeWhitespace(primaryAnchor.sourceText))) {
    const exactSourceText =
      primaryAnchor.startOffset >= 0 &&
      primaryAnchor.endOffset > primaryAnchor.startOffset &&
      primaryAnchor.endOffset <= page.rawText.length
        ? page.rawText.slice(primaryAnchor.startOffset, primaryAnchor.endOffset)
        : "";
    if (exactSourceText !== primaryAnchor.sourceText) {
      return null;
    }
  }

  const startOffset =
    primaryAnchor.startOffset >= 0
      ? primaryAnchor.startOffset
      : page.lines[primaryAnchor.lineStart - 1]?.startOffset;
  const endOffset =
    primaryAnchor.endOffset >= 0
      ? primaryAnchor.endOffset
      : page.lines[primaryAnchor.lineEnd - 1]?.endOffset;
  if (startOffset === undefined || endOffset === undefined) {
    return null;
  }

  return {
    text: normalizeWhitespace(obligation.description),
    anchor: {
      page_number: primaryAnchor.pageNumber,
      line_offset: primaryAnchor.lineStart - 1,
      quoted_text: primaryAnchor.sourceText,
      start_line: primaryAnchor.lineStart,
      end_line: primaryAnchor.lineEnd,
      start_offset: startOffset,
      end_offset: endOffset,
      source: "groq_obligation",
      obligation_type: obligation.obligationType,
      obligated_party: obligation.obligatedParty,
      beneficiary_party: obligation.beneficiaryParty,
      action: obligation.action,
      deliverable: obligation.deliverable,
      timing: obligation.timing,
      conditions: obligation.conditions,
      exceptions: obligation.exceptions,
      financial_terms: obligation.financialTerms,
      consequence: obligation.consequence,
      penalty: obligation.penalty,
      confidence: obligation.confidence,
      warnings: obligation.warnings,
      missing_fields: obligation.missingFields,
    },
  };
}

export class GroqObligationExtractionProvider implements ObligationExtractionProvider {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {GroqObligationExtractionDependencies} dependencies - Input value for dependencies.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly dependencies: GroqObligationExtractionDependencies) {}

  /**
   * @description Implements the extract method for this service or adapter.
   * @param {ObligationExtractionInput} input - Input value for input.
   * @returns {Promise<ObligationExtractionResult>} Result of the extract operation.
   */
  async extract(input: ObligationExtractionInput): Promise<ObligationExtractionResult> {
    const numberedPages = toNumberedPages(input.pages);
    const promptPages = selectGroqPromptPages(numberedPages);
    const pagesByNumber = new Map(numberedPages.map((page) => [page.pageNumber, page]));
    const prompt = buildPrompt(promptPages);

    this.dependencies.logger.info("groq_obligation_prompt_compacted", {
      contractId: input.context.contractId,
      documentId: input.context.documentId,
      processingRunId: input.context.processingRunId,
      sourcePageCount: numberedPages.length,
      promptPageCount: promptPages.length,
      promptLineCount: promptPages.reduce((count, page) => count + page.lines.length, 0),
      promptCharacterCount: prompt.length,
    });

    for (
      let attemptIndex = 0;
      attemptIndex < this.dependencies.config.maxAttempts;
      attemptIndex += 1
    ) {
      try {
        const response = await this.dependencies.llm.generateStructured({
          model: this.dependencies.config.model,
          prompt,
          responseSchemaName: "contract_obligation_extraction",
          systemInstruction:
            "You extract contract obligations as strict JSON. Every extracted obligation must be grounded in the supplied page lines.",
          timeoutMilliseconds: this.dependencies.config.timeoutMilliseconds,
          correlationId: input.context.processingRunId,
        });
        const parsed = groqResponseSchema.parse(response.parsedJson);
        const obligations = parsed.obligations
          .map((obligation) => verifyObligation(obligation, pagesByNumber))
          .filter((obligation): obligation is FieldAnchor => obligation !== null);

        if (obligations.length !== parsed.obligations.length) {
          this.dependencies.logger.warn("groq_obligation_source_verification_dropped_items", {
            contractId: input.context.contractId,
            documentId: input.context.documentId,
            processingRunId: input.context.processingRunId,
            requestedCount: parsed.obligations.length,
            verifiedCount: obligations.length,
          });
        }

        this.dependencies.logger.info("groq_obligations_extracted", {
          contractId: input.context.contractId,
          documentId: input.context.documentId,
          processingRunId: input.context.processingRunId,
          obligationCount: obligations.length,
        });

        return {
          extraction: { obligations },
          confidence: obligations.length > 0 ? 0.9 : 0.75,
          provider: "GROQ",
        };
      } catch (error) {
        const retryable = isRetryableError(error);
        const isLastAttempt = attemptIndex + 1 >= this.dependencies.config.maxAttempts;
        this.dependencies.logger.warn("groq_obligation_extraction_failed", {
          contractId: input.context.contractId,
          documentId: input.context.documentId,
          processingRunId: input.context.processingRunId,
          attempt: attemptIndex + 1,
          retryable,
          message: error instanceof Error ? error.message : String(error),
          details: errorDetails(error),
        });

        if (!retryable || isLastAttempt) {
          return this.runFallback(input);
        }

        await delay(toRetryDelay(attemptIndex, this.dependencies.config));
      }
    }

    return this.runFallback(input);
  }

  /**
   * @description Implements the run fallback method for this service or adapter.
   * @param {ObligationExtractionInput} input - Input value for input.
   * @returns {Promise<ObligationExtractionResult>} Result of the run fallback operation.
   */
  private async runFallback(input: ObligationExtractionInput): Promise<ObligationExtractionResult> {
    const fallback = await this.dependencies.fallback.extract(input);
    this.dependencies.logger.warn("groq_obligation_extraction_fell_back_to_heuristics", {
      contractId: input.context.contractId,
      documentId: input.context.documentId,
      processingRunId: input.context.processingRunId,
      obligationCount: fallback.extraction.obligations?.length ?? 0,
    });
    return fallback;
  }
}
