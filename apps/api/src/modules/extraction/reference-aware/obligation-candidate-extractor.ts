/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import { z } from "zod";

import type { StructuredLlmClient } from "../../../infrastructure/llm/structured-llm-client.js";
import { ExternalServiceError } from "../../../shared/errors/external-service-error.js";
import type {
  EvidenceRole,
  ExtractionReviewStatus,
  PartyResolution,
  RawObligationCandidate,
  VerifiedEvidenceSpan,
  VerifiedObligationCandidate,
} from "./reference-aware-extraction.schemas.js";
import {
  evidenceRoleSchema,
  obligationBusinessTypeSchema,
  obligationTimingTypeSchema,
  offsetDirectionSchema,
  offsetUnitSchema,
  partyResolutionMethodSchema,
} from "./reference-aware-extraction.schemas.js";
import type { DetectedCandidateWindow } from "./candidate-window-detector.js";
import type {
  ContractContextExtractionResult,
  RelevantContextSelection,
} from "./contract-context-extractor.js";
import { RelevantContextSelector } from "./contract-context-extractor.js";
import type {
  ContractSourceIndex,
  ContractSourceLine,
  ResolvedEvidenceSpanWithRole,
} from "./source-index.js";

export interface ObligationCandidateExtractorConfig {
  readonly lowConfidenceThreshold: number;
  readonly maxWindowsPerBatch: number;
  readonly maxBatchInputCharacters: number;
  readonly maxBatchOutputTokens: number;
}

export interface ObligationCandidateExtractorInput {
  readonly sourceIndex: ContractSourceIndex;
  readonly windows: readonly DetectedCandidateWindow[];
  readonly context: ContractContextExtractionResult;
  readonly signal?: AbortSignal;
}

export interface RejectedObligationCandidate {
  readonly windowId: string;
  readonly label: string;
  readonly reasons: readonly string[];
}

export interface ObligationCandidateExtractionResult {
  readonly rawCandidates: readonly RawObligationCandidate[];
  readonly verifiedCandidates: readonly VerifiedObligationCandidate[];
  readonly confirmed: readonly VerifiedObligationCandidate[];
  readonly reviewRequired: readonly VerifiedObligationCandidate[];
  readonly rejected: readonly RejectedObligationCandidate[];
}

export interface CandidateWindowBatch {
  readonly id: string;
  readonly windows: readonly DetectedCandidateWindow[];
  readonly estimatedInputCharacters: number;
}

const defaultConfig: ObligationCandidateExtractorConfig = {
  lowConfidenceThreshold: 0.7,
  maxWindowsPerBatch: 4,
  maxBatchInputCharacters: 18_000,
  maxBatchOutputTokens: 6_000,
};

const confidenceSchema = z.number().min(0).max(1);
const trimmedStringSchema = z.string().trim().min(1);

const modelEvidenceSpanSchema = z
  .object({
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    evidenceRole: evidenceRoleSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startLine > value.endLine) {
      context.addIssue({
        code: "custom",
        path: ["startLine"],
        message: "startLine must be less than or equal to endLine",
      });
    }
  });

const modelPartyResolutionSchema = z
  .object({
    explicitText: trimmedStringSchema.nullable(),
    roleLabel: trimmedStringSchema.nullable(),
    canonicalName: trimmedStringSchema.nullable(),
    resolutionMethod: partyResolutionMethodSchema,
    supportingEvidence: z.array(modelEvidenceSpanSchema).default([]),
    confidence: confidenceSchema,
    reviewReasons: z.array(trimmedStringSchema).default([]),
  })
  .strict();

const modelObligationCandidateSchema = z
  .object({
    businessType: obligationBusinessTypeSchema,
    timingType: obligationTimingTypeSchema,
    responsibleParty: modelPartyResolutionSchema,
    counterparty: modelPartyResolutionSchema.nullable(),
    action: trimmedStringSchema,
    object: trimmedStringSchema,
    summary: trimmedStringSchema,
    explicitDueDate: trimmedStringSchema.nullable(),
    triggerEvent: trimmedStringSchema.nullable(),
    referenceDateLabel: trimmedStringSchema.nullable(),
    offsetValue: z.number().nullable(),
    offsetUnit: offsetUnitSchema,
    offsetDirection: offsetDirectionSchema,
    frequency: trimmedStringSchema.nullable(),
    duration: trimmedStringSchema.nullable(),
    referencedTerms: z.array(trimmedStringSchema).default([]),
    crossReferences: z.array(trimmedStringSchema).default([]),
    evidenceSpans: z.array(modelEvidenceSpanSchema).min(1),
    confidence: confidenceSchema,
    reviewRequired: z.boolean(),
    reviewReasons: z.array(trimmedStringSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reviewRequired && value.reviewReasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reviewReasons"],
        message: "reviewReasons must contain at least one item when reviewRequired is true",
      });
    }
  });

const batchObligationExtractionSchema = z
  .object({
    windowResults: z
      .array(
        z
          .object({
            windowId: trimmedStringSchema,
            obligations: z.array(modelObligationCandidateSchema).default([]),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

type ModelEvidenceSpan = z.infer<typeof modelEvidenceSpanSchema>;
type ModelPartyResolution = z.infer<typeof modelPartyResolutionSchema>;
type ModelObligationCandidate = z.infer<typeof modelObligationCandidateSchema>;
type BatchObligationExtraction = z.infer<typeof batchObligationExtractionSchema>;

const modelEvidenceSpanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startLine: { type: "number" },
    endLine: { type: "number" },
    evidenceRole: {
      type: "string",
      enum: evidenceRoleSchema.options,
    },
  },
  required: ["startLine", "endLine", "evidenceRole"],
} satisfies Record<string, unknown>;

const modelPartyResolutionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    explicitText: { type: ["string", "null"] },
    roleLabel: { type: ["string", "null"] },
    canonicalName: { type: ["string", "null"] },
    resolutionMethod: {
      type: "string",
      enum: partyResolutionMethodSchema.options,
    },
    supportingEvidence: {
      type: "array",
      items: modelEvidenceSpanJsonSchema,
    },
    confidence: { type: "number" },
    reviewReasons: { type: "array", items: { type: "string" } },
  },
  required: [
    "explicitText",
    "roleLabel",
    "canonicalName",
    "resolutionMethod",
    "supportingEvidence",
    "confidence",
    "reviewReasons",
  ],
} satisfies Record<string, unknown>;

const obligationCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          businessType: {
            type: "string",
            enum: [
              "RENEWAL",
              "TERMINATION_NOTICE",
              "PAYMENT",
              "DELIVERY",
              "SERVICE_PERFORMANCE",
              "REPORTING",
              "NOTIFICATION",
              "RECURRING_OPERATION",
              "INSURANCE",
              "RECORD_RETENTION",
              "POST_TERMINATION",
              "OTHER",
            ],
          },
          timingType: {
            type: "string",
            enum: [
              "FIXED_DATE",
              "RELATIVE_DEADLINE",
              "RECURRING",
              "NOTICE_WINDOW",
              "EVENT_TRIGGERED",
              "ONGOING",
              "NO_EXPLICIT_DEADLINE",
            ],
          },
          responsibleParty: modelPartyResolutionJsonSchema,
          counterparty: { anyOf: [modelPartyResolutionJsonSchema, { type: "null" }] },
          action: { type: "string" },
          object: { type: "string" },
          summary: { type: "string" },
          explicitDueDate: { type: ["string", "null"] },
          triggerEvent: { type: ["string", "null"] },
          referenceDateLabel: { type: ["string", "null"] },
          offsetValue: { type: ["number", "null"] },
          offsetUnit: {
            type: ["string", "null"],
            enum: ["hours", "days", "business_days", "weeks", "months", "years", null],
          },
          offsetDirection: { type: ["string", "null"], enum: ["before", "after", null] },
          frequency: { type: ["string", "null"] },
          duration: { type: ["string", "null"] },
          referencedTerms: { type: "array", items: { type: "string" } },
          crossReferences: { type: "array", items: { type: "string" } },
          evidenceSpans: { type: "array", items: modelEvidenceSpanJsonSchema },
          confidence: { type: "number" },
          reviewRequired: { type: "boolean" },
          reviewReasons: { type: "array", items: { type: "string" } },
        },
        required: [
          "businessType",
          "timingType",
          "responsibleParty",
          "counterparty",
          "action",
          "object",
          "summary",
          "explicitDueDate",
          "triggerEvent",
          "referenceDateLabel",
          "offsetValue",
          "offsetUnit",
          "offsetDirection",
          "frequency",
          "duration",
          "referencedTerms",
          "crossReferences",
          "evidenceSpans",
          "confidence",
          "reviewRequired",
          "reviewReasons",
        ],
      },
    },
  },
  required: ["candidates"],
} satisfies Record<string, unknown>;

const batchObligationCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    windowResults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          windowId: { type: "string" },
          obligations: {
            type: "array",
            items: obligationCandidateJsonSchema.properties.candidates.items,
          },
        },
        required: ["windowId", "obligations"],
      },
    },
  },
  required: ["windowResults"],
} satisfies Record<string, unknown>;

/**
 * @description Performs the render party map helper operation for this module.
 * @param {RelevantContextSelection} selection - Input value for selection.
 * @returns {string} Result of the render party map operation.
 */
function renderPartyMap(selection: RelevantContextSelection): string {
  if (selection.canonicalPartyMap.length === 0) {
    return "[]";
  }
  return selection.canonicalPartyMap
    .map(
      (party) =>
        `- ${party.roleLabel}: ${party.canonicalName}; aliases: ${
          party.aliases.length > 0 ? party.aliases.join(", ") : "none"
        }`,
    )
    .join("\n");
}

/**
 * @description Performs the render defined terms helper operation for this module.
 * @param {RelevantContextSelection} selection - Input value for selection.
 * @returns {string} Result of the render defined terms operation.
 */
function renderDefinedTerms(selection: RelevantContextSelection): string {
  if (selection.definedTerms.length === 0) {
    return "[]";
  }
  return selection.definedTerms
    .map((term) => {
      const value =
        term.definition ??
        term.referencedSection ??
        term.referencedExhibit ??
        term.resolutionStatus;
      return `- ${term.term}: ${value}`;
    })
    .join("\n");
}

/**
 * @description Performs the render batch source helper operation for this module.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @returns {string} Result of the render batch source operation.
 */
function renderBatchSource(window: DetectedCandidateWindow): string {
  return window.sourceLines
    .map((line) => {
      const pageLocalLine =
        line.pageLocalLineNumber !== null ? `L.${line.pageLocalLineNumber}` : "L.?";
      const marker = window.targetGlobalLines.includes(line.globalLineNumber) ? "*" : " ";
      return `${marker} [P.${line.pageNumber} | ${pageLocalLine} | G.${line.globalLineNumber}] ${line.normalizedText}`;
    })
    .join("\n");
}

/**
 * @description Performs the estimated window characters helper operation for this module.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @returns {number} Result of the estimated window characters operation.
 */
function estimatedWindowCharacters(window: DetectedCandidateWindow): number {
  return window.characterCount + window.sectionPath.join(" > ").length + window.id.length + 160;
}

/**
 * @description Performs the same batch section helper operation for this module.
 * @param {DetectedCandidateWindow} left - Input value for left.
 * @param {DetectedCandidateWindow} right - Input value for right.
 * @returns {boolean} Result of the same batch section operation.
 */
function sameBatchSection(left: DetectedCandidateWindow, right: DetectedCandidateWindow): boolean {
  return (
    left.sectionPath.length > 0 &&
    left.sectionPath.length === right.sectionPath.length &&
    left.sectionPath.every((value, index) => value === right.sectionPath[index])
  );
}

/**
 * @description Performs the batch id helper operation for this module.
 * @param {readonly DetectedCandidateWindow[]} windows - Input value for windows.
 * @returns {string} Result of the batch id operation.
 */
function batchId(windows: readonly DetectedCandidateWindow[]): string {
  return `cb_${stableHash(
    JSON.stringify(
      windows.map((window) => ({
        id: window.id,
        start: window.globalStartLine,
        end: window.globalEndLine,
      })),
    ),
  )}`;
}

/**
 * @description Performs the build candidate window batches helper operation for this module.
 * @param {readonly DetectedCandidateWindow[]} windows - Input value for windows.
 * @param {Pick< ObligationCandidateExtractorConfig, "maxWindowsPerBatch" | "maxBatchInputCharacters" >} config - Input value for config.
 * @returns {readonly CandidateWindowBatch[]} Result of the build candidate window batches operation.
 */
export function buildCandidateWindowBatches(
  windows: readonly DetectedCandidateWindow[],
  config: Pick<
    ObligationCandidateExtractorConfig,
    "maxWindowsPerBatch" | "maxBatchInputCharacters"
  >,
): readonly CandidateWindowBatch[] {
  const sortedWindows = [...windows].sort(
    (left, right) =>
      left.globalStartLine - right.globalStartLine ||
      left.globalEndLine - right.globalEndLine ||
      left.id.localeCompare(right.id),
  );
  const batches: CandidateWindowBatch[] = [];
  let current: DetectedCandidateWindow[] = [];
  let currentCharacters = 0;

  /**
   * @description Performs the flush helper operation for this module.
   * @returns {void} Result of the flush operation.
   */
  function flush(): void {
    if (current.length === 0) {
      return;
    }
    batches.push({
      id: batchId(current),
      windows: current,
      estimatedInputCharacters: currentCharacters,
    });
    current = [];
    currentCharacters = 0;
  }

  for (const window of sortedWindows) {
    const estimatedCharacters = estimatedWindowCharacters(window);
    const previous = current[current.length - 1];
    const exceedsWindowCount = current.length >= config.maxWindowsPerBatch;
    const exceedsCharacters =
      current.length > 0 &&
      currentCharacters + estimatedCharacters > config.maxBatchInputCharacters;
    const sectionBreak =
      previous &&
      !sameBatchSection(previous, window) &&
      current.length >= config.maxWindowsPerBatch - 1;

    if (exceedsWindowCount || exceedsCharacters || sectionBreak) {
      flush();
    }

    current.push(window);
    currentCharacters += estimatedCharacters;

    if (estimatedCharacters > config.maxBatchInputCharacters) {
      flush();
    }
  }
  flush();

  return batches;
}

/**
 * @description Performs the evidence references helper operation for this module.
 * @param {readonly ModelEvidenceSpan[]} spans - Input value for spans.
 * @returns {unknown} Result of the evidence references operation.
 */
function evidenceReferences(spans: readonly ModelEvidenceSpan[]) {
  return spans.map((span) => ({
    startLine: span.startLine,
    endLine: span.endLine,
    evidenceRole: span.evidenceRole,
  }));
}

/**
 * @description Performs the to page evidence span helper operation for this module.
 * @param {ResolvedEvidenceSpanWithRole} resolved - Input value for resolved.
 * @returns {VerifiedEvidenceSpan | null} Result of the to page evidence span operation.
 */
function toPageEvidenceSpan(resolved: ResolvedEvidenceSpanWithRole): VerifiedEvidenceSpan | null {
  const firstLine = resolved.sourceLines[0];
  const lastLine = resolved.sourceLines[resolved.sourceLines.length - 1];
  if (
    resolved.verificationErrors.length > 0 ||
    !firstLine ||
    !lastLine ||
    firstLine.pageNumber !== lastLine.pageNumber ||
    resolved.exactQuote.length === 0
  ) {
    return null;
  }

  return {
    pageNumber: firstLine.pageNumber,
    startLine: firstLine.pageLocalLineNumber ?? firstLine.globalLineNumber,
    endLine: lastLine.pageLocalLineNumber ?? lastLine.globalLineNumber,
    evidenceRole: resolved.evidenceRole,
    exactQuote: resolved.exactQuote,
    normalizedQuote: resolved.exactQuote,
    verificationErrors: [],
  };
}

/**
 * @description Performs the to evidence candidate helper operation for this module.
 * @param {ResolvedEvidenceSpanWithRole} resolved - Input value for resolved.
 * @returns {unknown} Result of the to evidence candidate operation.
 */
function toEvidenceCandidate(resolved: ResolvedEvidenceSpanWithRole) {
  const firstLine = resolved.sourceLines[0];
  const lastLine = resolved.sourceLines[resolved.sourceLines.length - 1];
  if (
    resolved.verificationErrors.length > 0 ||
    !firstLine ||
    !lastLine ||
    firstLine.pageNumber !== lastLine.pageNumber
  ) {
    return null;
  }

  return {
    pageNumber: firstLine.pageNumber,
    startLine: firstLine.pageLocalLineNumber ?? firstLine.globalLineNumber,
    endLine: lastLine.pageLocalLineNumber ?? lastLine.globalLineNumber,
    evidenceRole: resolved.evidenceRole,
  };
}

/**
 * @description Performs the normalize evidence spans helper operation for this module.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @param {readonly ModelEvidenceSpan[]} spans - Input value for spans.
 * @returns {unknown} Result of the normalize evidence spans operation.
 */
function normalizeEvidenceSpans(
  sourceIndex: ContractSourceIndex,
  spans: readonly ModelEvidenceSpan[],
) {
  const resolved = sourceIndex.resolveEvidenceSpans(evidenceReferences(spans));
  const verifiedEvidenceSpans = resolved
    .map(toPageEvidenceSpan)
    .filter((span): span is VerifiedEvidenceSpan => Boolean(span));
  const evidenceSpans = resolved.map(toEvidenceCandidate).filter(
    (
      span,
    ): span is {
      pageNumber: number;
      startLine: number;
      endLine: number;
      evidenceRole: EvidenceRole;
    } => Boolean(span),
  );
  const reviewReasons = resolved.flatMap((span) =>
    span.verificationErrors.map((error) => error.message),
  );

  if (
    resolved.some((span) => {
      const firstLine = span.sourceLines[0];
      const lastLine = span.sourceLines[span.sourceLines.length - 1];
      return firstLine && lastLine && firstLine.pageNumber !== lastLine.pageNumber;
    })
  ) {
    reviewReasons.push("Evidence span crosses pages and requires review");
  }

  return {
    evidenceSpans,
    verifiedEvidenceSpans,
    reviewReasons,
  };
}

/**
 * @description Performs the find party helper operation for this module.
 * @param {ContractContextExtractionResult} context - Input value for context.
 * @param {string | null} value - Input value for value.
 * @returns {unknown} Result of the find party operation.
 */
function findParty(context: ContractContextExtractionResult, value: string | null) {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  return context.parties.find((party) =>
    [party.canonicalName, party.roleLabel, ...party.aliases].some(
      (candidate) => candidate.toLowerCase() === normalized,
    ),
  );
}

/**
 * @description Performs the contains term helper operation for this module.
 * @param {string} text - Input value for text.
 * @param {string} term - Input value for term.
 * @returns {boolean} Result of the contains term operation.
 */
function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

/**
 * @description Performs the resolve party helper operation for this module.
 * @param {ModelPartyResolution} party - Input value for party.
 * @param {ContractContextExtractionResult} context - Input value for context.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @returns {{ readonly party: PartyResolution; readonly reviewReasons: readonly string[] }} Result of the resolve party operation.
 */
function resolveParty(
  party: ModelPartyResolution,
  context: ContractContextExtractionResult,
  sourceIndex: ContractSourceIndex,
): { readonly party: PartyResolution; readonly reviewReasons: readonly string[] } {
  const match =
    findParty(context, party.canonicalName) ??
    findParty(context, party.roleLabel) ??
    findParty(context, party.explicitText);
  const supportingEvidence = normalizeEvidenceSpans(sourceIndex, party.supportingEvidence);
  const reviewReasons = [...party.reviewReasons, ...supportingEvidence.reviewReasons];

  if (match) {
    return {
      party: {
        explicitText: party.explicitText,
        roleLabel: match.roleLabel,
        canonicalName: match.canonicalName,
        resolutionMethod: party.resolutionMethod,
        supportingEvidence: supportingEvidence.evidenceSpans,
        confidence: party.confidence,
        reviewReasons,
      },
      reviewReasons,
    };
  }

  const unresolvedReasons =
    party.resolutionMethod === "UNRESOLVED" || party.resolutionMethod === "AMBIGUOUS"
      ? reviewReasons
      : [...reviewReasons, "Party could not be resolved through ContractContext"];

  return {
    party: {
      explicitText: party.explicitText,
      roleLabel: party.roleLabel,
      canonicalName: party.canonicalName,
      resolutionMethod: party.resolutionMethod,
      supportingEvidence: supportingEvidence.evidenceSpans,
      confidence: party.confidence,
      reviewReasons: unresolvedReasons,
    },
    reviewReasons: unresolvedReasons,
  };
}

/**
 * @description Performs the is excluded evidence line helper operation for this module.
 * @param {ContractSourceLine} line - Input value for line.
 * @returns {boolean} Result of the is excluded evidence line operation.
 */
function isExcludedEvidenceLine(line: ContractSourceLine): boolean {
  const text = line.normalizedText;
  return (
    /\bshall\s+mean\b/i.test(text) ||
    /^["'A-Z][^.;:]{0,120}\bmeans\b/i.test(text) ||
    /^(?:whereas|recitals?)\b/i.test(text) ||
    /\b(?:governing law|severability|entire agreement)\b/i.test(text) ||
    (/\bmay\b/i.test(text) && !/\b(?:shall|must|required\s+to|payable|due)\b/i.test(text))
  );
}

/**
 * @description Performs the all evidence excluded helper operation for this module.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @param {ModelObligationCandidate} candidate - Input value for candidate.
 * @returns {boolean} Result of the all evidence excluded operation.
 */
function allEvidenceExcluded(
  sourceIndex: ContractSourceIndex,
  candidate: ModelObligationCandidate,
): boolean {
  const lines = candidate.evidenceSpans.flatMap((span) => {
    const resolved = sourceIndex.resolveEvidenceSpan(span.startLine, span.endLine);
    return resolved.sourceLines;
  });
  return lines.length > 0 && lines.every(isExcludedEvidenceLine);
}

/**
 * @description Performs the cross reference needs review helper operation for this module.
 * @param {{ readonly crossReferences: readonly string[] }} candidate - Input value for candidate.
 * @param {ContractContextExtractionResult} context - Input value for context.
 * @returns {string[]} Result of the cross reference needs review operation.
 */
function crossReferenceNeedsReview(
  candidate: { readonly crossReferences: readonly string[] },
  context: ContractContextExtractionResult,
): string[] {
  return candidate.crossReferences.flatMap((crossReference) => {
    const lower = crossReference.toLowerCase();
    const matchedTerm = context.definedTerms.find((term) =>
      [term.term, term.referencedSection, term.referencedExhibit]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase() === lower),
    );
    if (!matchedTerm) {
      return [`Cross-reference ${crossReference} was not provided in context`];
    }
    if (matchedTerm.resolutionStatus !== "RESOLVED") {
      return [`Cross-reference ${crossReference} is unavailable or unresolved`];
    }
    return [];
  });
}

/**
 * @description Performs the supported cross references helper operation for this module.
 * @param {ModelObligationCandidate} candidate - Input value for candidate.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @param {ContractContextExtractionResult} context - Input value for context.
 * @returns {string[]} Result of the supported cross references operation.
 */
function supportedCrossReferences(
  candidate: ModelObligationCandidate,
  window: DetectedCandidateWindow,
  context: ContractContextExtractionResult,
): string[] {
  const windowText = window.sourceLines.map((line) => line.normalizedText).join("\n");
  return candidate.crossReferences.filter((crossReference) => {
    if (containsTerm(windowText, crossReference)) {
      return true;
    }
    const lower = crossReference.toLowerCase();
    return context.definedTerms.some((term) =>
      [term.term, term.referencedSection, term.referencedExhibit]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase() === lower),
    );
  });
}

/**
 * @description Performs the stable hash helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string} Result of the stable hash operation.
 */
function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * @description Performs the normalize key text helper operation for this module.
 * @param {string | null} value - Input value for value.
 * @returns {string} Result of the normalize key text operation.
 */
function normalizeKeyText(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * @description Performs the sorted unique strings helper operation for this module.
 * @param {readonly string[]} values - Input value for values.
 * @returns {readonly string[]} Result of the sorted unique strings operation.
 */
function sortedUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(normalizeKeyText))].sort((left, right) =>
    left.localeCompare(right),
  );
}

/**
 * @description Performs the sorted evidence spans helper operation for this module.
 * @param {readonly ModelEvidenceSpan[]} spans - Input value for spans.
 * @returns {readonly ModelEvidenceSpan[]} Result of the sorted evidence spans operation.
 */
function sortedEvidenceSpans(spans: readonly ModelEvidenceSpan[]): readonly ModelEvidenceSpan[] {
  return [...spans].sort(
    (left, right) =>
      left.startLine - right.startLine ||
      left.endLine - right.endLine ||
      left.evidenceRole.localeCompare(right.evidenceRole),
  );
}

/**
 * @description Performs the stable candidate key helper operation for this module.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @param {ModelObligationCandidate} candidate - Input value for candidate.
 * @returns {string} Result of the stable candidate key operation.
 */
function stableCandidateKey(
  window: DetectedCandidateWindow,
  candidate: ModelObligationCandidate,
): string {
  return `oc_${window.id}_${stableHash(
    JSON.stringify({
      businessType: candidate.businessType,
      timingType: candidate.timingType,
      responsibleParty: {
        explicitText: normalizeKeyText(candidate.responsibleParty.explicitText),
        roleLabel: normalizeKeyText(candidate.responsibleParty.roleLabel),
        canonicalName: normalizeKeyText(candidate.responsibleParty.canonicalName),
        resolutionMethod: candidate.responsibleParty.resolutionMethod,
      },
      counterparty: candidate.counterparty
        ? {
            explicitText: normalizeKeyText(candidate.counterparty.explicitText),
            roleLabel: normalizeKeyText(candidate.counterparty.roleLabel),
            canonicalName: normalizeKeyText(candidate.counterparty.canonicalName),
            resolutionMethod: candidate.counterparty.resolutionMethod,
          }
        : null,
      action: normalizeKeyText(candidate.action),
      object: normalizeKeyText(candidate.object),
      explicitDueDate: normalizeKeyText(candidate.explicitDueDate),
      triggerEvent: normalizeKeyText(candidate.triggerEvent),
      referenceDateLabel: normalizeKeyText(candidate.referenceDateLabel),
      offsetValue: candidate.offsetValue,
      offsetUnit: candidate.offsetUnit,
      offsetDirection: candidate.offsetDirection,
      frequency: normalizeKeyText(candidate.frequency),
      duration: normalizeKeyText(candidate.duration),
      referencedTerms: sortedUniqueStrings(candidate.referencedTerms),
      crossReferences: sortedUniqueStrings(candidate.crossReferences),
      evidenceSpans: sortedEvidenceSpans(candidate.evidenceSpans),
    }),
  )}`;
}

/**
 * @description Performs the review status helper operation for this module.
 * @param {{ readonly candidate: ModelObligationCandidate; readonly reviewReasons: readonly string[]; readonly lowConfidenceThreshold: number; }} input - Input value for input.
 * @returns {ExtractionReviewStatus} Result of the review status operation.
 */
function reviewStatus(input: {
  readonly candidate: ModelObligationCandidate;
  readonly reviewReasons: readonly string[];
  readonly lowConfidenceThreshold: number;
}): ExtractionReviewStatus {
  if (
    input.candidate.reviewRequired ||
    input.candidate.confidence < input.lowConfidenceThreshold ||
    input.reviewReasons.length > 0
  ) {
    return "REVIEW_REQUIRED";
  }
  return "CONFIRMED";
}

/**
 * @description Performs the merge relevant context helper operation for this module.
 * @param {readonly RelevantContextSelection[]} selections - Input value for selections.
 * @returns {RelevantContextSelection} Result of the merge relevant context operation.
 */
function mergeRelevantContext(
  selections: readonly RelevantContextSelection[],
): RelevantContextSelection {
  const parties = new Map<string, RelevantContextSelection["parties"][number]>();
  const definedTerms = new Map<string, RelevantContextSelection["definedTerms"][number]>();
  const keyDates = new Map<string, RelevantContextSelection["keyDates"][number]>();
  const partyMap = new Map<string, RelevantContextSelection["canonicalPartyMap"][number]>();

  for (const selection of selections) {
    for (const party of selection.parties) {
      parties.set(`${party.roleLabel}:${party.canonicalName}`, party);
    }
    for (const term of selection.definedTerms) {
      definedTerms.set(term.term, term);
    }
    for (const date of selection.keyDates) {
      keyDates.set(`${date.label}:${date.rawValue}`, date);
    }
    for (const party of selection.canonicalPartyMap) {
      partyMap.set(`${party.roleLabel}:${party.canonicalName}`, party);
    }
  }

  return {
    canonicalPartyMap: [...partyMap.values()].sort(
      (left, right) =>
        left.roleLabel.localeCompare(right.roleLabel) ||
        left.canonicalName.localeCompare(right.canonicalName),
    ),
    parties: [...parties.values()].sort(
      (left, right) =>
        left.roleLabel.localeCompare(right.roleLabel) ||
        left.canonicalName.localeCompare(right.canonicalName),
    ),
    definedTerms: [...definedTerms.values()].sort((left, right) =>
      left.term.localeCompare(right.term),
    ),
    keyDates: [...keyDates.values()].sort(
      (left, right) =>
        left.label.localeCompare(right.label) || left.rawValue.localeCompare(right.rawValue),
    ),
  };
}

/**
 * @description Performs the evidence within window helper operation for this module.
 * @param {ModelObligationCandidate} candidate - Input value for candidate.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @returns {boolean} Result of the evidence within window operation.
 */
function evidenceWithinWindow(
  candidate: ModelObligationCandidate,
  window: DetectedCandidateWindow,
): boolean {
  return candidate.evidenceSpans.every(
    (span) => span.startLine >= window.globalStartLine && span.endLine <= window.globalEndLine,
  );
}

/**
 * @description Performs the words for matching helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {readonly string[]} Result of the words for matching operation.
 */
function wordsForMatching(value: string): readonly string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 4);
}

/**
 * @description Performs the add deterministic action evidence helper operation for this module.
 * @param {ModelObligationCandidate} candidate - Input value for candidate.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @returns {ModelObligationCandidate} Result of the add deterministic action evidence operation.
 */
function addDeterministicActionEvidence(
  candidate: ModelObligationCandidate,
  window: DetectedCandidateWindow,
): ModelObligationCandidate {
  if (candidate.evidenceSpans.some((span) => span.evidenceRole === "ACTION")) {
    return candidate;
  }
  if (!/\bpay\b/i.test(candidate.action)) {
    return candidate;
  }
  const objectWords = wordsForMatching(candidate.object);
  const actionLine = window.sourceLines.find((line) => {
    const text = line.normalizedText.toLowerCase();
    return /\bshall\s+pay\b/.test(text) && objectWords.every((word) => text.includes(word));
  });
  if (!actionLine) {
    return candidate;
  }
  return {
    ...candidate,
    evidenceSpans: [
      ...candidate.evidenceSpans,
      {
        startLine: actionLine.globalLineNumber,
        endLine: actionLine.globalLineNumber,
        evidenceRole: "ACTION",
      },
    ],
  };
}

export class ObligationCandidateExtractor {
  private readonly llm: StructuredLlmClient;
  private readonly relevantContextSelector: RelevantContextSelector;
  private readonly config: ObligationCandidateExtractorConfig;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {{ readonly llm: StructuredLlmClient; readonly relevantContextSelector?: RelevantContextSelector; readonly config?: Partial<ObligationCandidateExtractorConfig>; }} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: {
    readonly llm: StructuredLlmClient;
    readonly relevantContextSelector?: RelevantContextSelector;
    readonly config?: Partial<ObligationCandidateExtractorConfig>;
  }) {
    this.llm = input.llm;
    this.relevantContextSelector = input.relevantContextSelector ?? new RelevantContextSelector();
    this.config = { ...defaultConfig, ...input.config };
  }

  /**
   * @description Implements the extract method for this service or adapter.
   * @param {ObligationCandidateExtractorInput} input - Input value for input.
   * @returns {Promise<ObligationCandidateExtractionResult>} Result of the extract operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async extract(
    input: ObligationCandidateExtractorInput,
  ): Promise<ObligationCandidateExtractionResult> {
    const rawCandidates: RawObligationCandidate[] = [];
    const verifiedCandidates: VerifiedObligationCandidate[] = [];
    const rejected: RejectedObligationCandidate[] = [];

    for (const batch of buildCandidateWindowBatches(input.windows, this.config)) {
      const relevantContext = mergeRelevantContext(
        batch.windows.map((window) =>
          this.relevantContextSelector.select({
            window,
            context: input.context,
            sourceIndex: input.sourceIndex,
          }),
        ),
      );
      const raw = await this.llm.generateStructured<BatchObligationExtraction>({
        operationName: "obligation_candidate_extraction",
        systemInstruction:
          "Extract operationally trackable obligation candidates only. Return JSON grouped by windowId with line numbers only.",
        prompt: this.renderBatchPrompt(batch, relevantContext),
        jsonSchema: batchObligationCandidateJsonSchema,
        validator: batchObligationExtractionSchema,
        maxOutputTokens: this.config.maxBatchOutputTokens,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      const windowById = new Map(batch.windows.map((window) => [window.id, window]));
      const seenWindowIds = new Set<string>();

      for (const windowResult of raw.windowResults) {
        const window = windowById.get(windowResult.windowId);
        if (!window) {
          throw new ExternalServiceError("Batch obligation extraction returned unknown window ID", {
            operationName: "obligation_candidate_extraction",
            retryable: false,
            batchId: batch.id,
            windowId: windowResult.windowId,
          });
        }
        if (seenWindowIds.has(window.id)) {
          throw new ExternalServiceError(
            "Batch obligation extraction returned duplicate window ID",
            {
              operationName: "obligation_candidate_extraction",
              retryable: false,
              batchId: batch.id,
              windowId: window.id,
            },
          );
        }
        seenWindowIds.add(window.id);

        for (const extractedCandidate of windowResult.obligations) {
          const candidate = addDeterministicActionEvidence(extractedCandidate, window);
          if (!evidenceWithinWindow(candidate, window)) {
            rejected.push({
              windowId: window.id,
              label: candidate.summary,
              reasons: ["Candidate evidence is outside the returned window"],
            });
            continue;
          }
          if (allEvidenceExcluded(input.sourceIndex, candidate)) {
            rejected.push({
              windowId: window.id,
              label: candidate.summary,
              reasons: ["Candidate evidence is excluded by extraction scope"],
            });
            continue;
          }

          const normalizedEvidence = normalizeEvidenceSpans(
            input.sourceIndex,
            candidate.evidenceSpans,
          );
          if (normalizedEvidence.verifiedEvidenceSpans.length === 0) {
            rejected.push({
              windowId: window.id,
              label: candidate.summary,
              reasons:
                normalizedEvidence.reviewReasons.length > 0
                  ? normalizedEvidence.reviewReasons
                  : ["Candidate has no valid source evidence"],
            });
            continue;
          }

          const responsibleParty = resolveParty(
            candidate.responsibleParty,
            input.context,
            input.sourceIndex,
          );
          const counterparty = candidate.counterparty
            ? resolveParty(candidate.counterparty, input.context, input.sourceIndex)
            : null;
          const crossReferences = supportedCrossReferences(candidate, window, input.context);
          const candidateForReview = { crossReferences };
          const reviewReasons = [
            ...candidate.reviewReasons,
            ...normalizedEvidence.reviewReasons,
            ...responsibleParty.reviewReasons,
            ...(counterparty?.reviewReasons ?? []),
            ...crossReferenceNeedsReview(candidateForReview, input.context),
            ...(candidate.confidence < this.config.lowConfidenceThreshold
              ? ["Candidate confidence is below review threshold"]
              : []),
          ];
          const rawCandidate: RawObligationCandidate = {
            ...candidate,
            responsibleParty: responsibleParty.party,
            counterparty: counterparty?.party ?? null,
            referencedTerms: [...candidate.referencedTerms],
            crossReferences,
            evidenceSpans: normalizedEvidence.evidenceSpans,
            reviewRequired: candidate.reviewRequired || reviewReasons.length > 0,
            reviewReasons,
          };
          const verifiedCandidate: VerifiedObligationCandidate = {
            businessType: rawCandidate.businessType,
            timingType: rawCandidate.timingType,
            responsibleParty: rawCandidate.responsibleParty,
            counterparty: rawCandidate.counterparty,
            action: rawCandidate.action,
            object: rawCandidate.object,
            summary: rawCandidate.summary,
            explicitDueDate: rawCandidate.explicitDueDate,
            triggerEvent: rawCandidate.triggerEvent,
            referenceDateLabel: rawCandidate.referenceDateLabel,
            offsetValue: rawCandidate.offsetValue,
            offsetUnit: rawCandidate.offsetUnit,
            offsetDirection: rawCandidate.offsetDirection,
            frequency: rawCandidate.frequency,
            duration: rawCandidate.duration,
            referencedTerms: rawCandidate.referencedTerms,
            crossReferences: rawCandidate.crossReferences,
            verifiedEvidenceSpans: normalizedEvidence.verifiedEvidenceSpans,
            confidence: rawCandidate.confidence,
            reviewStatus: reviewStatus({
              candidate,
              reviewReasons,
              lowConfidenceThreshold: this.config.lowConfidenceThreshold,
            }),
            reviewReasons,
            stableCandidateKey: stableCandidateKey(window, candidate),
          };

          rawCandidates.push(rawCandidate);
          verifiedCandidates.push(verifiedCandidate);
        }
      }

      const missingWindowIds = batch.windows
        .map((window) => window.id)
        .filter((windowId) => !seenWindowIds.has(windowId));
      if (missingWindowIds.length > 0) {
        throw new ExternalServiceError("Batch obligation extraction omitted window results", {
          operationName: "obligation_candidate_extraction",
          retryable: false,
          batchId: batch.id,
          missingWindowIds,
        });
      }
    }

    return {
      rawCandidates,
      verifiedCandidates,
      confirmed: verifiedCandidates.filter((candidate) => candidate.reviewStatus === "CONFIRMED"),
      reviewRequired: verifiedCandidates.filter(
        (candidate) => candidate.reviewStatus === "REVIEW_REQUIRED",
      ),
      rejected,
    };
  }

  /**
   * @description Implements the render batch prompt method for this service or adapter.
   * @param {CandidateWindowBatch} batch - Input value for batch.
   * @param {RelevantContextSelection} relevantContext - Input value for relevant context.
   * @returns {string} Result of the render batch prompt operation.
   */
  private renderBatchPrompt(
    batch: CandidateWindowBatch,
    relevantContext: RelevantContextSelection,
  ): string {
    return [
      "CONTRACT PARTY MAP",
      "------------------",
      renderPartyMap(relevantContext),
      "",
      "RELEVANT DEFINED TERMS BY WINDOW",
      "--------------------------------",
      renderDefinedTerms(relevantContext),
      "",
      "WINDOWS",
      "-------",
      batch.windows
        .map((window) =>
          [
            `WINDOW ID: ${window.id}`,
            `SECTION: ${window.sectionPath.length > 0 ? window.sectionPath.join(" > ") : "[]"}`,
            `SECTION PATH: ${window.sectionPath.length > 0 ? window.sectionPath.join(" > ") : "[]"}`,
            "SOURCE:",
            "PREVIOUS/TARGET/FOLLOWING SOURCE LINES:",
            renderBatchSource(window),
          ].join("\n"),
        )
        .join("\n\n"),
      "",
      "EXTRACTION SCOPE",
      [
        "Include only operationally trackable duties: renewal, termination notice, payment, delivery, scheduled service or performance, reporting, notification, recurring operational duties, insurance or certificate duties, record-retention duties, event-triggered duties, and post-termination duties.",
        "Exclude definitions, recitals, descriptive statements, standalone permissions and rights, interpretation boilerplate, governing law, severability, entire agreement, broad liability language without trackable action, and general confidentiality or compliance with no timing or operational event.",
      ].join("\n"),
      "",
      "REFERENCE-RESOLUTION RULES",
      [
        "1. Return every obligation under the correct windowId.",
        "2. Do not create unknown window IDs.",
        "3. Evidence for an obligation must belong to that window.",
        "4. Use the G line numbers shown next to each source line for startLine and endLine.",
        "5. Do not return exact quotes.",
        "6. Do not combine different payment, fee, revenue-share, commission, reimbursement, or refund objects. If one sentence names multiple payable objects, return one obligation for each distinct object.",
        "7. Return an empty obligations array for a window with no qualifying duty.",
        "8. When a duty line explicitly names a party role from the party map, use that role and canonical party. Return REVIEW_REQUIRED only when the responsible party is absent, ambiguous, or not resolvable from ContractContext.",
        "9. Defined payment terms and exhibit terms can be obligation objects when the source window states that a party shall pay, reimburse, remit, share, or owe them.",
        "10. For recurring payment duties, capture frequency, trigger event, offset value/unit/direction, and the payment object as the distinguishing subject.",
      ].join("\n"),
      "",
      'Return JSON only with shape: { "windowResults": [{ "windowId": string, "obligations": [] }] }.',
    ].join("\n");
  }
}
