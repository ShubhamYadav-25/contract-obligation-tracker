/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type { DetectedCandidateWindow } from "./candidate-window-detector.js";
import type {
  EvidenceRole,
  ExtractionReviewStatus,
  ObligationBusinessType,
  ObligationTimingType,
  OffsetDirection,
  OffsetUnit,
  PartyResolution,
  VerifiedObligationCandidate,
} from "./reference-aware-extraction.schemas.js";
import type { ContractSourceIndex, ContractSourceLine } from "./source-index.js";

export interface ObligationSourceVerifierConfig {
  readonly confidenceThreshold: number;
}

export interface ObligationReviewGateConfig {
  readonly confidenceThreshold: number;
}

export interface ObligationSourceVerificationInput {
  readonly sourceIndex: ContractSourceIndex;
  readonly items: readonly ObligationSourceVerificationItem[];
}

export interface ObligationSourceVerificationItem {
  readonly candidate: VerifiedObligationCandidate;
  readonly window: DetectedCandidateWindow;
}

export interface SourceVerifiedEvidenceSpan {
  readonly evidenceRole: EvidenceRole;
  readonly globalStartLine: number;
  readonly globalEndLine: number;
  readonly startPage: number;
  readonly endPage: number;
  readonly exactQuote: string;
  readonly normalizedQuote: string;
}

export interface SourceVerifiedOperationalObligation {
  readonly stableObligationId: string;
  readonly sourceCandidateKeys: readonly string[];
  readonly businessType: ObligationBusinessType;
  readonly timingType: ObligationTimingType;
  readonly responsibleParty: PartyResolution;
  readonly counterparty: PartyResolution | null;
  readonly action: string;
  readonly object: string;
  readonly summary: string;
  readonly explicitDueDate: string | null;
  readonly triggerEvent: string | null;
  readonly referenceDateLabel: string | null;
  readonly offsetValue: number | null;
  readonly offsetUnit: OffsetUnit;
  readonly offsetDirection: OffsetDirection;
  readonly frequency: string | null;
  readonly duration: string | null;
  readonly referencedTerms: readonly string[];
  readonly crossReferences: readonly string[];
  readonly sectionPath: readonly string[];
  readonly sourceEvidence: readonly SourceVerifiedEvidenceSpan[];
  readonly confidence: number;
  readonly reviewStatus: ExtractionReviewStatus;
  readonly reviewReasons: readonly string[];
}

export interface RejectedSourceObligation {
  readonly stableCandidateKey: string;
  readonly label: string;
  readonly reviewStatus: "REJECTED";
  readonly reviewReasons: readonly string[];
}

export interface ObligationSourceVerificationResult {
  readonly verified: readonly SourceVerifiedOperationalObligation[];
  readonly confirmed: readonly SourceVerifiedOperationalObligation[];
  readonly reviewRequired: readonly SourceVerifiedOperationalObligation[];
  readonly rejected: readonly RejectedSourceObligation[];
}

interface ReviewGateInput {
  readonly candidate: VerifiedObligationCandidate;
  readonly sourceEvidence: readonly SourceVerifiedEvidenceSpan[];
  readonly sourceErrors: readonly string[];
}

const defaultConfig: ObligationSourceVerifierConfig = {
  confidenceThreshold: 0.7,
};

const unresolvedPartyMethods = new Set(["AMBIGUOUS", "UNRESOLVED"]);

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
 * @description Performs the sorted unique helper operation for this module.
 * @param {readonly string[]} values - Input value for values.
 * @returns {readonly string[]} Result of the sorted unique operation.
 */
function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * @description Performs the with reason helper operation for this module.
 * @param {readonly string[]} reasons - Input value for reasons.
 * @param {string} reason - Input value for reason.
 * @returns {readonly string[]} Result of the with reason operation.
 */
function withReason(reasons: readonly string[], reason: string): readonly string[] {
  return sortedUnique([...reasons, reason]);
}

/**
 * @description Performs the unique evidence helper operation for this module.
 * @param {readonly SourceVerifiedEvidenceSpan[]} spans - Input value for spans.
 * @returns {readonly SourceVerifiedEvidenceSpan[]} Result of the unique evidence operation.
 */
function uniqueEvidence(
  spans: readonly SourceVerifiedEvidenceSpan[],
): readonly SourceVerifiedEvidenceSpan[] {
  const seen = new Set<string>();
  const result: SourceVerifiedEvidenceSpan[] = [];
  for (const span of [...spans].sort(evidenceSort)) {
    const key = `${span.evidenceRole}:${span.globalStartLine}:${span.globalEndLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(span);
  }
  return result;
}

/**
 * @description Performs the evidence sort helper operation for this module.
 * @param {SourceVerifiedEvidenceSpan} left - Input value for left.
 * @param {SourceVerifiedEvidenceSpan} right - Input value for right.
 * @returns {number} Result of the evidence sort operation.
 */
function evidenceSort(left: SourceVerifiedEvidenceSpan, right: SourceVerifiedEvidenceSpan): number {
  const roleOrder: readonly EvidenceRole[] = [
    "ACTOR",
    "COUNTERPARTY",
    "ACTION",
    "OBJECT",
    "AMOUNT",
    "TIMING",
    "CONDITION",
    "DEFINITION",
    "CROSS_REFERENCE",
  ];
  const leftRoleRank = roleOrder.indexOf(left.evidenceRole);
  const rightRoleRank = roleOrder.indexOf(right.evidenceRole);
  return (
    left.globalStartLine - right.globalStartLine ||
    left.globalEndLine - right.globalEndLine ||
    leftRoleRank - rightRoleRank ||
    left.evidenceRole.localeCompare(right.evidenceRole)
  );
}

/**
 * @description Performs the candidate sort key helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @returns {string} Result of the candidate sort key operation.
 */
function candidateSortKey(candidate: VerifiedObligationCandidate): string {
  return JSON.stringify({
    responsibleParty: normalizeKeyText(candidate.responsibleParty.canonicalName),
    counterparty: normalizeKeyText(candidate.counterparty?.canonicalName ?? null),
    action: normalizeKeyText(candidate.action),
    object: normalizeKeyText(candidate.object),
    evidence: candidate.verifiedEvidenceSpans.map((span) => [
      span.evidenceRole,
      span.pageNumber,
      span.startLine,
      span.endLine,
    ]),
    stableCandidateKey: candidate.stableCandidateKey,
  });
}

/**
 * @description Performs the obligation identity helper operation for this module.
 * @param {{ readonly sourceCandidateKeys?: readonly string[]; readonly businessType: ObligationBusinessType; readonly timingType: ObligationTimingType; readonly responsibleParty: PartyResolution; readonly counterparty: PartyResolution | null; readonly action: string; readonly object: string; readonly explicitDueDate: string | null; readonly triggerEvent: string | null; readonly referenceDateLabel: string | null; readonly offsetValue: number | null; readonly offsetUnit: OffsetUnit; readonly offsetDirection: OffsetDirection; readonly frequency: string | null; readonly duration: string | null; readonly sectionPath: readonly string[]; readonly sourceEvidence: readonly SourceVerifiedEvidenceSpan[]; }} input - Input value for input.
 * @returns {string} Result of the obligation identity operation.
 */
function obligationIdentity(input: {
  readonly sourceCandidateKeys?: readonly string[];
  readonly businessType: ObligationBusinessType;
  readonly timingType: ObligationTimingType;
  readonly responsibleParty: PartyResolution;
  readonly counterparty: PartyResolution | null;
  readonly action: string;
  readonly object: string;
  readonly explicitDueDate: string | null;
  readonly triggerEvent: string | null;
  readonly referenceDateLabel: string | null;
  readonly offsetValue: number | null;
  readonly offsetUnit: OffsetUnit;
  readonly offsetDirection: OffsetDirection;
  readonly frequency: string | null;
  readonly duration: string | null;
  readonly sectionPath: readonly string[];
  readonly sourceEvidence: readonly SourceVerifiedEvidenceSpan[];
}): string {
  return `ob_${stableHash(
    JSON.stringify({
      businessType: input.businessType,
      timingType: input.timingType,
      responsibleParty: normalizeKeyText(input.responsibleParty.canonicalName),
      counterparty: normalizeKeyText(input.counterparty?.canonicalName ?? null),
      action: normalizeKeyText(input.action),
      object: normalizeKeyText(input.object),
      explicitDueDate: normalizeKeyText(input.explicitDueDate),
      triggerEvent: normalizeKeyText(input.triggerEvent),
      referenceDateLabel: normalizeKeyText(input.referenceDateLabel),
      offsetValue: input.offsetValue,
      offsetUnit: input.offsetUnit,
      offsetDirection: input.offsetDirection,
      frequency: normalizeKeyText(input.frequency),
      duration: normalizeKeyText(input.duration),
      sectionPath: input.sectionPath,
      sourceEvidence: input.sourceEvidence.map((span) => [
        span.evidenceRole,
        span.globalStartLine,
        span.globalEndLine,
      ]),
    }),
  )}`;
}

/**
 * @description Performs the first global line for page local range helper operation for this module.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @param {number} pageNumber - Input value for page number.
 * @param {number} pageLocalLineNumber - Input value for page local line number.
 * @returns {ContractSourceLine | null} Result of the first global line for page local range operation.
 */
function firstGlobalLineForPageLocalRange(
  sourceIndex: ContractSourceIndex,
  pageNumber: number,
  pageLocalLineNumber: number,
): ContractSourceLine | null {
  return (
    sourceIndex.lines.find(
      (line) => line.pageNumber === pageNumber && line.pageLocalLineNumber === pageLocalLineNumber,
    ) ?? null
  );
}

/**
 * @description Performs the resolve candidate evidence span helper operation for this module.
 * @param {{ readonly sourceIndex: ContractSourceIndex; readonly candidate: VerifiedObligationCandidate; readonly span: VerifiedObligationCandidate["verifiedEvidenceSpans"][number]; readonly window: DetectedCandidateWindow; }} input - Input value for input.
 * @returns {{ readonly evidence: SourceVerifiedEvidenceSpan | null; readonly errors: readonly string[] }} Result of the resolve candidate evidence span operation.
 */
function resolveCandidateEvidenceSpan(input: {
  readonly sourceIndex: ContractSourceIndex;
  readonly candidate: VerifiedObligationCandidate;
  readonly span: VerifiedObligationCandidate["verifiedEvidenceSpans"][number];
  readonly window: DetectedCandidateWindow;
}): { readonly evidence: SourceVerifiedEvidenceSpan | null; readonly errors: readonly string[] } {
  const startLine = firstGlobalLineForPageLocalRange(
    input.sourceIndex,
    input.span.pageNumber,
    input.span.startLine,
  );
  const endLine = firstGlobalLineForPageLocalRange(
    input.sourceIndex,
    input.span.pageNumber,
    input.span.endLine,
  );
  const errors: string[] = [];

  if (!startLine) {
    errors.push(`Missing source start line P${input.span.pageNumber}:L${input.span.startLine}`);
  }
  if (!endLine) {
    errors.push(`Missing source end line P${input.span.pageNumber}:L${input.span.endLine}`);
  }
  if (!startLine || !endLine) {
    return { evidence: null, errors };
  }

  const resolved = input.sourceIndex.resolveEvidenceSpan(
    startLine.globalLineNumber,
    endLine.globalLineNumber,
  );
  errors.push(...resolved.verificationErrors.map((error) => error.message));

  if (
    startLine.globalLineNumber < input.window.globalStartLine ||
    endLine.globalLineNumber > input.window.globalEndLine
  ) {
    errors.push(
      `Evidence ${startLine.globalLineNumber}-${endLine.globalLineNumber} is outside candidate window ${input.window.globalStartLine}-${input.window.globalEndLine}`,
    );
  }

  if (
    resolved.verificationErrors.length > 0 ||
    !resolved.startPage ||
    !resolved.endPage ||
    resolved.exactQuote.length === 0
  ) {
    return { evidence: null, errors };
  }

  return {
    evidence: {
      evidenceRole: input.span.evidenceRole,
      globalStartLine: startLine.globalLineNumber,
      globalEndLine: endLine.globalLineNumber,
      startPage: resolved.startPage,
      endPage: resolved.endPage,
      exactQuote: resolved.exactQuote,
      normalizedQuote: resolved.exactQuote,
    },
    errors,
  };
}

/**
 * @description Performs the is definition candidate helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @returns {boolean} Result of the is definition candidate operation.
 */
function isDefinitionCandidate(candidate: VerifiedObligationCandidate): boolean {
  const action = normalizeKeyText(candidate.action);
  return (
    candidate.verifiedEvidenceSpans.some((span) => span.evidenceRole === "DEFINITION") ||
    /\bshall\s+mean\b/i.test(candidate.summary) ||
    action === "mean" ||
    action === "means" ||
    action === "define" ||
    action === "defined"
  );
}

/**
 * @description Performs the is rights only candidate helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @returns {boolean} Result of the is rights only candidate operation.
 */
function isRightsOnlyCandidate(candidate: VerifiedObligationCandidate): boolean {
  return (
    /\bmay\b/i.test(candidate.summary) &&
    !/\b(?:shall|must|required\s+to|payable|due)\b/i.test(candidate.summary)
  );
}

/**
 * @description Performs the has resolved responsible party helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @returns {boolean} Result of the has resolved responsible party operation.
 */
function hasResolvedResponsibleParty(candidate: VerifiedObligationCandidate): boolean {
  return (
    candidate.responsibleParty.canonicalName !== null &&
    candidate.responsibleParty.roleLabel !== null &&
    !unresolvedPartyMethods.has(candidate.responsibleParty.resolutionMethod)
  );
}

/**
 * @description Performs the has valid actor basis helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @param {readonly SourceVerifiedEvidenceSpan[]} sourceEvidence - Input value for source evidence.
 * @returns {boolean} Result of the has valid actor basis operation.
 */
function hasValidActorBasis(
  candidate: VerifiedObligationCandidate,
  sourceEvidence: readonly SourceVerifiedEvidenceSpan[],
): boolean {
  return (
    sourceEvidence.some((span) => span.evidenceRole === "ACTOR") ||
    candidate.responsibleParty.supportingEvidence.some((span) => span.evidenceRole === "ACTOR") ||
    (hasResolvedResponsibleParty(candidate) &&
      [
        "EXPLICIT_IN_SENTENCE",
        "EXPLICIT_IN_PARAGRAPH",
        "INHERITED_FROM_ADJACENT_CONTEXT",
        "CONTRACT_PARTY_MAP",
        "DEFINED_TERM",
      ].includes(candidate.responsibleParty.resolutionMethod))
  );
}

/**
 * @description Performs the has unresolved core cross reference helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @returns {boolean} Result of the has unresolved core cross reference operation.
 */
function hasUnresolvedCoreCrossReference(candidate: VerifiedObligationCandidate): boolean {
  if (candidate.crossReferences.length === 0) {
    return false;
  }
  return (
    candidate.reviewReasons.some((reason) =>
      /\b(?:unresolved|unavailable|not provided|missing|ambiguous)\b/i.test(reason),
    ) || candidate.reviewStatus !== "CONFIRMED"
  );
}

/**
 * @description Performs the to rejected helper operation for this module.
 * @param {VerifiedObligationCandidate} candidate - Input value for candidate.
 * @param {readonly string[]} reviewReasons - Input value for review reasons.
 * @returns {RejectedSourceObligation} Result of the to rejected operation.
 */
function toRejected(
  candidate: VerifiedObligationCandidate,
  reviewReasons: readonly string[],
): RejectedSourceObligation {
  return {
    stableCandidateKey: candidate.stableCandidateKey,
    label: candidate.summary,
    reviewStatus: "REJECTED",
    reviewReasons: sortedUnique(reviewReasons),
  };
}

export class ObligationReviewGate {
  private readonly config: ObligationReviewGateConfig;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Partial<ObligationReviewGateConfig>} config - Input value for config.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(config: Partial<ObligationReviewGateConfig> = {}) {
    this.config = { confidenceThreshold: defaultConfig.confidenceThreshold, ...config };
  }

  /**
   * @description Implements the evaluate method for this service or adapter.
   * @param {ReviewGateInput} input - Input value for input.
   * @returns {{ readonly reviewStatus: ExtractionReviewStatus; readonly reviewReasons: readonly string[]; }} Result of the evaluate operation.
   */
  evaluate(input: ReviewGateInput): {
    readonly reviewStatus: ExtractionReviewStatus;
    readonly reviewReasons: readonly string[];
  } {
    let reviewReasons = sortedUnique([...input.candidate.reviewReasons, ...input.sourceErrors]);

    if (isDefinitionCandidate(input.candidate)) {
      return {
        reviewStatus: "REJECTED",
        reviewReasons: withReason(reviewReasons, "Candidate is definition-only"),
      };
    }
    if (isRightsOnlyCandidate(input.candidate)) {
      return {
        reviewStatus: "REJECTED",
        reviewReasons: withReason(reviewReasons, "Candidate is rights-only and lacks a duty"),
      };
    }
    if (input.sourceErrors.length > 0 || input.sourceEvidence.length === 0) {
      return {
        reviewStatus: "REJECTED",
        reviewReasons: withReason(reviewReasons, "Candidate has invalid source evidence"),
      };
    }
    if (!input.sourceEvidence.some((span) => span.evidenceRole === "ACTION")) {
      reviewReasons = withReason(reviewReasons, "Missing ACTION evidence");
    }
    if (!hasValidActorBasis(input.candidate, input.sourceEvidence)) {
      reviewReasons = withReason(
        reviewReasons,
        "Missing ACTOR evidence or valid contextual party resolution",
      );
    }
    if (!hasResolvedResponsibleParty(input.candidate)) {
      reviewReasons = withReason(reviewReasons, "Responsible party is unresolved");
    }
    if (input.candidate.confidence < this.config.confidenceThreshold) {
      reviewReasons = withReason(reviewReasons, "Candidate confidence is below review threshold");
    }
    if (hasUnresolvedCoreCrossReference(input.candidate)) {
      reviewReasons = withReason(reviewReasons, "Unresolved cross-reference affects core meaning");
    }

    return {
      reviewStatus: reviewReasons.length > 0 ? "REVIEW_REQUIRED" : "CONFIRMED",
      reviewReasons,
    };
  }
}

export class ObligationSourceVerifier {
  private readonly gate: ObligationReviewGate;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Partial<ObligationSourceVerifierConfig>} config - Input value for config.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(config: Partial<ObligationSourceVerifierConfig> = {}) {
    this.gate = new ObligationReviewGate({
      confidenceThreshold: { ...defaultConfig, ...config }.confidenceThreshold,
    });
  }

  /**
   * @description Implements the verify method for this service or adapter.
   * @param {ObligationSourceVerificationInput} input - Input value for input.
   * @returns {ObligationSourceVerificationResult} Result of the verify operation.
   */
  verify(input: ObligationSourceVerificationInput): ObligationSourceVerificationResult {
    const verified: SourceVerifiedOperationalObligation[] = [];
    const rejected: RejectedSourceObligation[] = [];

    for (const item of [...input.items].sort((left, right) =>
      candidateSortKey(left.candidate).localeCompare(candidateSortKey(right.candidate)),
    )) {
      const resolvedSpans = item.candidate.verifiedEvidenceSpans.map((span) =>
        resolveCandidateEvidenceSpan({
          sourceIndex: input.sourceIndex,
          candidate: item.candidate,
          span,
          window: item.window,
        }),
      );
      const sourceErrors = resolvedSpans.flatMap((span) => span.errors);
      const sourceEvidence = uniqueEvidence(
        resolvedSpans
          .map((span) => span.evidence)
          .filter((span): span is SourceVerifiedEvidenceSpan => Boolean(span)),
      );
      const gateResult = this.gate.evaluate({
        candidate: item.candidate,
        sourceEvidence,
        sourceErrors,
      });

      if (gateResult.reviewStatus === "REJECTED") {
        rejected.push(toRejected(item.candidate, gateResult.reviewReasons));
        continue;
      }

      const obligation: SourceVerifiedOperationalObligation = {
        stableObligationId: obligationIdentity({
          ...item.candidate,
          sectionPath: item.window.sectionPath,
          sourceEvidence,
        }),
        sourceCandidateKeys: [item.candidate.stableCandidateKey],
        businessType: item.candidate.businessType,
        timingType: item.candidate.timingType,
        responsibleParty: item.candidate.responsibleParty,
        counterparty: item.candidate.counterparty,
        action: item.candidate.action,
        object: item.candidate.object,
        summary: item.candidate.summary,
        explicitDueDate: item.candidate.explicitDueDate,
        triggerEvent: item.candidate.triggerEvent,
        referenceDateLabel: item.candidate.referenceDateLabel,
        offsetValue: item.candidate.offsetValue,
        offsetUnit: item.candidate.offsetUnit,
        offsetDirection: item.candidate.offsetDirection,
        frequency: item.candidate.frequency,
        duration: item.candidate.duration,
        referencedTerms: item.candidate.referencedTerms,
        crossReferences: item.candidate.crossReferences,
        sectionPath: item.window.sectionPath,
        sourceEvidence,
        confidence: item.candidate.confidence,
        reviewStatus: gateResult.reviewStatus,
        reviewReasons: gateResult.reviewReasons,
      };

      verified.push(obligation);
    }

    return {
      verified,
      confirmed: verified.filter((obligation) => obligation.reviewStatus === "CONFIRMED"),
      reviewRequired: verified.filter(
        (obligation) => obligation.reviewStatus === "REVIEW_REQUIRED",
      ),
      rejected,
    };
  }
}

/**
 * @description Performs the dedupe key helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @returns {string} Result of the dedupe key operation.
 */
function dedupeKey(obligation: SourceVerifiedOperationalObligation): string {
  return JSON.stringify({
    businessType: obligation.businessType,
    timingType: obligation.timingType,
    responsibleParty: normalizeKeyText(obligation.responsibleParty.canonicalName),
    counterparty: normalizeKeyText(obligation.counterparty?.canonicalName ?? null),
    action: normalizeKeyText(obligation.action),
    object: normalizeKeyText(obligation.object),
    explicitDueDate: normalizeKeyText(obligation.explicitDueDate),
    triggerEvent: normalizeKeyText(obligation.triggerEvent),
    referenceDateLabel: normalizeKeyText(obligation.referenceDateLabel),
    offsetValue: obligation.offsetValue,
    offsetUnit: obligation.offsetUnit,
    offsetDirection: obligation.offsetDirection,
    frequency: normalizeKeyText(obligation.frequency),
    duration: normalizeKeyText(obligation.duration),
    sectionPath: obligation.sectionPath,
    evidence: obligation.sourceEvidence.map((span) => [
      span.evidenceRole,
      span.globalStartLine,
      span.globalEndLine,
    ]),
  });
}

export class ObligationDeduplicator {
  /**
   * @description Implements the deduplicate method for this service or adapter.
   * @param {readonly SourceVerifiedOperationalObligation[]} obligations - Input value for obligations.
   * @returns {readonly SourceVerifiedOperationalObligation[]} Result of the deduplicate operation.
   */
  deduplicate(
    obligations: readonly SourceVerifiedOperationalObligation[],
  ): readonly SourceVerifiedOperationalObligation[] {
    const byKey = new Map<string, SourceVerifiedOperationalObligation>();
    for (const obligation of [...obligations].sort((left, right) =>
      left.stableObligationId.localeCompare(right.stableObligationId),
    )) {
      const key = dedupeKey(obligation);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, obligation);
        continue;
      }
      byKey.set(key, {
        ...existing,
        sourceCandidateKeys: sortedUnique([
          ...existing.sourceCandidateKeys,
          ...obligation.sourceCandidateKeys,
        ]),
        reviewReasons: sortedUnique([...existing.reviewReasons, ...obligation.reviewReasons]),
      });
    }

    return [...byKey.values()].sort((left, right) =>
      left.stableObligationId.localeCompare(right.stableObligationId),
    );
  }
}

/**
 * @description Performs the same party helper operation for this module.
 * @param {PartyResolution | null} left - Input value for left.
 * @param {PartyResolution | null} right - Input value for right.
 * @returns {boolean} Result of the same party operation.
 */
function sameParty(left: PartyResolution | null, right: PartyResolution | null): boolean {
  return (
    normalizeKeyText(left?.canonicalName ?? null) === normalizeKeyText(right?.canonicalName ?? null)
  );
}

/**
 * @description Performs the same section helper operation for this module.
 * @param {readonly string[]} left - Input value for left.
 * @param {readonly string[]} right - Input value for right.
 * @returns {boolean} Result of the same section operation.
 */
function sameSection(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => normalizeKeyText(value) === normalizeKeyText(right[index] ?? ""))
  );
}

/**
 * @description Performs the evidence bounds helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} obligation - Input value for obligation.
 * @returns {{ readonly start: number; readonly end: number; }} Result of the evidence bounds operation.
 */
function evidenceBounds(obligation: SourceVerifiedOperationalObligation): {
  readonly start: number;
  readonly end: number;
} {
  const starts = obligation.sourceEvidence.map((span) => span.globalStartLine);
  const ends = obligation.sourceEvidence.map((span) => span.globalEndLine);
  return {
    start: Math.min(...starts),
    end: Math.max(...ends),
  };
}

/**
 * @description Performs the evidence adjacent or overlapping helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} left - Input value for left.
 * @param {SourceVerifiedOperationalObligation} right - Input value for right.
 * @returns {boolean} Result of the evidence adjacent or overlapping operation.
 */
function evidenceAdjacentOrOverlapping(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): boolean {
  const leftBounds = evidenceBounds(left);
  const rightBounds = evidenceBounds(right);
  return leftBounds.start <= rightBounds.end + 1 && rightBounds.start <= leftBounds.end + 1;
}

/**
 * @description Performs the should consolidate helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} left - Input value for left.
 * @param {SourceVerifiedOperationalObligation} right - Input value for right.
 * @returns {boolean} Result of the should consolidate operation.
 */
function shouldConsolidate(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): boolean {
  return (
    sameParty(left.responsibleParty, right.responsibleParty) &&
    sameParty(left.counterparty, right.counterparty) &&
    normalizeKeyText(left.action) === normalizeKeyText(right.action) &&
    normalizeKeyText(left.object) === normalizeKeyText(right.object) &&
    sameSection(left.sectionPath, right.sectionPath) &&
    evidenceAdjacentOrOverlapping(left, right)
  );
}

/**
 * @description Performs the combined status helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} left - Input value for left.
 * @param {SourceVerifiedOperationalObligation} right - Input value for right.
 * @returns {ExtractionReviewStatus} Result of the combined status operation.
 */
function combinedStatus(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): ExtractionReviewStatus {
  return left.reviewStatus === "REVIEW_REQUIRED" || right.reviewStatus === "REVIEW_REQUIRED"
    ? "REVIEW_REQUIRED"
    : "CONFIRMED";
}

/**
 * @description Performs the combine obligations helper operation for this module.
 * @param {SourceVerifiedOperationalObligation} left - Input value for left.
 * @param {SourceVerifiedOperationalObligation} right - Input value for right.
 * @returns {SourceVerifiedOperationalObligation} Result of the combine obligations operation.
 */
function combineObligations(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): SourceVerifiedOperationalObligation {
  const sourceEvidence = uniqueEvidence([...left.sourceEvidence, ...right.sourceEvidence]);
  const combined = {
    ...left,
    timingType: left.timingType === "NO_EXPLICIT_DEADLINE" ? right.timingType : left.timingType,
    explicitDueDate: left.explicitDueDate ?? right.explicitDueDate,
    triggerEvent: left.triggerEvent ?? right.triggerEvent,
    referenceDateLabel: left.referenceDateLabel ?? right.referenceDateLabel,
    offsetValue: left.offsetValue ?? right.offsetValue,
    offsetUnit: left.offsetUnit ?? right.offsetUnit,
    offsetDirection: left.offsetDirection ?? right.offsetDirection,
    frequency: left.frequency ?? right.frequency,
    duration: left.duration ?? right.duration,
    summary:
      right.summary.length > left.summary.length && right.summary.includes(left.object)
        ? right.summary
        : left.summary,
    referencedTerms: sortedUnique([...left.referencedTerms, ...right.referencedTerms]),
    crossReferences: sortedUnique([...left.crossReferences, ...right.crossReferences]),
    sourceEvidence,
    confidence: Math.min(left.confidence, right.confidence),
    reviewStatus: combinedStatus(left, right),
    reviewReasons: sortedUnique([...left.reviewReasons, ...right.reviewReasons]),
    sourceCandidateKeys: sortedUnique([...left.sourceCandidateKeys, ...right.sourceCandidateKeys]),
  } satisfies Omit<SourceVerifiedOperationalObligation, "stableObligationId">;

  return {
    ...combined,
    stableObligationId: obligationIdentity(combined),
  };
}

export class ObligationConsolidator {
  /**
   * @description Implements the consolidate method for this service or adapter.
   * @param {readonly SourceVerifiedOperationalObligation[]} obligations - Input value for obligations.
   * @returns {readonly SourceVerifiedOperationalObligation[]} Result of the consolidate operation.
   */
  consolidate(
    obligations: readonly SourceVerifiedOperationalObligation[],
  ): readonly SourceVerifiedOperationalObligation[] {
    const sorted = [...obligations].sort((left, right) => {
      const leftBounds = evidenceBounds(left);
      const rightBounds = evidenceBounds(right);
      return (
        leftBounds.start - rightBounds.start ||
        leftBounds.end - rightBounds.end ||
        left.stableObligationId.localeCompare(right.stableObligationId)
      );
    });
    const result: SourceVerifiedOperationalObligation[] = [];

    for (const obligation of sorted) {
      const previous = result[result.length - 1];
      if (previous && shouldConsolidate(previous, obligation)) {
        result[result.length - 1] = combineObligations(previous, obligation);
        continue;
      }
      result.push(obligation);
    }

    return result.sort((left, right) =>
      left.stableObligationId.localeCompare(right.stableObligationId),
    );
  }
}
