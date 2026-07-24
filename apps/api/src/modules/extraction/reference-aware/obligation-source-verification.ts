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

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeKeyText(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function withReason(reasons: readonly string[], reason: string): readonly string[] {
  return sortedUnique([...reasons, reason]);
}

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

function firstGlobalLineForPageLocalRange(
  sourceIndex: ContractSourceIndex,
  pageNumber: number,
  pageLocalLineNumber: number,
): ContractSourceLine | null {
  return (
    sourceIndex.lines.find(
      (line) =>
        line.pageNumber === pageNumber && line.pageLocalLineNumber === pageLocalLineNumber,
    ) ?? null
  );
}

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
    errors.push(
      `Missing source start line P${input.span.pageNumber}:L${input.span.startLine}`,
    );
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

function isRightsOnlyCandidate(candidate: VerifiedObligationCandidate): boolean {
  return /\bmay\b/i.test(candidate.summary) && !/\b(?:shall|must|required\s+to|payable|due)\b/i.test(candidate.summary);
}

function hasResolvedResponsibleParty(candidate: VerifiedObligationCandidate): boolean {
  return (
    candidate.responsibleParty.canonicalName !== null &&
    candidate.responsibleParty.roleLabel !== null &&
    !unresolvedPartyMethods.has(candidate.responsibleParty.resolutionMethod)
  );
}

function hasValidActorBasis(
  candidate: VerifiedObligationCandidate,
  sourceEvidence: readonly SourceVerifiedEvidenceSpan[],
): boolean {
  return (
    sourceEvidence.some((span) => span.evidenceRole === "ACTOR") ||
    candidate.responsibleParty.supportingEvidence.some(
      (span) => span.evidenceRole === "ACTOR",
    ) ||
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

  constructor(config: Partial<ObligationReviewGateConfig> = {}) {
    this.config = { confidenceThreshold: defaultConfig.confidenceThreshold, ...config };
  }

  evaluate(input: ReviewGateInput): {
    readonly reviewStatus: ExtractionReviewStatus;
    readonly reviewReasons: readonly string[];
  } {
    let reviewReasons = sortedUnique([
      ...input.candidate.reviewReasons,
      ...input.sourceErrors,
    ]);

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
      reviewReasons = withReason(
        reviewReasons,
        "Unresolved cross-reference affects core meaning",
      );
    }

    return {
      reviewStatus: reviewReasons.length > 0 ? "REVIEW_REQUIRED" : "CONFIRMED",
      reviewReasons,
    };
  }
}

export class ObligationSourceVerifier {
  private readonly gate: ObligationReviewGate;

  constructor(config: Partial<ObligationSourceVerifierConfig> = {}) {
    this.gate = new ObligationReviewGate({
      confidenceThreshold: { ...defaultConfig, ...config }.confidenceThreshold,
    });
  }

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

function sameParty(left: PartyResolution | null, right: PartyResolution | null): boolean {
  return normalizeKeyText(left?.canonicalName ?? null) === normalizeKeyText(right?.canonicalName ?? null);
}

function sameSection(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => normalizeKeyText(value) === normalizeKeyText(right[index] ?? ""))
  );
}

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

function evidenceAdjacentOrOverlapping(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): boolean {
  const leftBounds = evidenceBounds(left);
  const rightBounds = evidenceBounds(right);
  return leftBounds.start <= rightBounds.end + 1 && rightBounds.start <= leftBounds.end + 1;
}

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

function combinedStatus(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): ExtractionReviewStatus {
  return left.reviewStatus === "REVIEW_REQUIRED" || right.reviewStatus === "REVIEW_REQUIRED"
    ? "REVIEW_REQUIRED"
    : "CONFIRMED";
}

function combineObligations(
  left: SourceVerifiedOperationalObligation,
  right: SourceVerifiedOperationalObligation,
): SourceVerifiedOperationalObligation {
  const sourceEvidence = uniqueEvidence([...left.sourceEvidence, ...right.sourceEvidence]);
  const combined = {
    ...left,
    timingType:
      left.timingType === "NO_EXPLICIT_DEADLINE" ? right.timingType : left.timingType,
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
    sourceCandidateKeys: sortedUnique([
      ...left.sourceCandidateKeys,
      ...right.sourceCandidateKeys,
    ]),
  } satisfies Omit<SourceVerifiedOperationalObligation, "stableObligationId">;

  return {
    ...combined,
    stableObligationId: obligationIdentity(combined),
  };
}

export class ObligationConsolidator {
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
