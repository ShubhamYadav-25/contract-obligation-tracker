import { z } from "zod";

export const obligationBusinessTypeSchema = z.enum([
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
]);
export type ObligationBusinessType = z.infer<typeof obligationBusinessTypeSchema>;

export const obligationTimingTypeSchema = z.enum([
  "FIXED_DATE",
  "RELATIVE_DEADLINE",
  "RECURRING",
  "NOTICE_WINDOW",
  "EVENT_TRIGGERED",
  "ONGOING",
  "NO_EXPLICIT_DEADLINE",
]);
export type ObligationTimingType = z.infer<typeof obligationTimingTypeSchema>;

export const evidenceRoleSchema = z.enum([
  "ACTOR",
  "COUNTERPARTY",
  "ACTION",
  "OBJECT",
  "TIMING",
  "AMOUNT",
  "CONDITION",
  "DEFINITION",
  "CROSS_REFERENCE",
]);
export type EvidenceRole = z.infer<typeof evidenceRoleSchema>;

export const partyResolutionMethodSchema = z.enum([
  "EXPLICIT_IN_SENTENCE",
  "EXPLICIT_IN_PARAGRAPH",
  "INHERITED_FROM_ADJACENT_CONTEXT",
  "CONTRACT_PARTY_MAP",
  "DEFINED_TERM",
  "AMBIGUOUS",
  "UNRESOLVED",
]);
export type PartyResolutionMethod = z.infer<typeof partyResolutionMethodSchema>;

export const referenceResolutionStatusSchema = z.enum([
  "RESOLVED",
  "PARTIALLY_RESOLVED",
  "UNRESOLVED",
  "AMBIGUOUS",
]);
export type ReferenceResolutionStatus = z.infer<typeof referenceResolutionStatusSchema>;

export const extractionReviewStatusSchema = z.enum([
  "CONFIRMED",
  "REVIEW_REQUIRED",
  "REJECTED",
]);
export type ExtractionReviewStatus = z.infer<typeof extractionReviewStatusSchema>;

export const candidateWindowSourceMethodSchema = z.enum([
  "PDF_TEXT",
  "TESSERACT",
  "GEMINI_VISION",
]);
export type CandidateWindowSourceMethod = z.infer<typeof candidateWindowSourceMethodSchema>;

export const offsetUnitSchema = z
  .enum(["hours", "days", "business_days", "weeks", "months", "years"])
  .nullable();
export type OffsetUnit = z.infer<typeof offsetUnitSchema>;

export const offsetDirectionSchema = z.enum(["before", "after"]).nullable();
export type OffsetDirection = z.infer<typeof offsetDirectionSchema>;

const trimmedStringSchema = z.string().trim().min(1);
const confidenceSchema = z.number().min(0).max(1);

function validateSinglePageRange(
  value: { readonly startLine: number; readonly endLine: number },
  context: z.RefinementCtx,
): void {
  if (value.startLine > value.endLine) {
    context.addIssue({
      code: "custom",
      path: ["startLine"],
      message: "startLine must be less than or equal to endLine",
    });
  }
}

export const sourceLineRangeSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict()
  .superRefine(validateSinglePageRange);
export type SourceLineRange = z.infer<typeof sourceLineRangeSchema>;

export const evidenceSpanCandidateSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    evidenceRole: evidenceRoleSchema,
  })
  .strict()
  .superRefine(validateSinglePageRange);
export type EvidenceSpanCandidate = z.infer<typeof evidenceSpanCandidateSchema>;

export const contractPartySchema = z
  .object({
    roleLabel: trimmedStringSchema,
    canonicalName: trimmedStringSchema,
    aliases: z.array(trimmedStringSchema).default([]),
    source: sourceLineRangeSchema,
  })
  .strict();
export type ContractParty = z.infer<typeof contractPartySchema>;

export const definedTermSchema = z
  .object({
    term: trimmedStringSchema,
    definition: trimmedStringSchema.nullable(),
    referencedSection: trimmedStringSchema.nullable(),
    referencedExhibit: trimmedStringSchema.nullable(),
    resolutionStatus: referenceResolutionStatusSchema,
    source: sourceLineRangeSchema,
  })
  .strict();
export type DefinedTerm = z.infer<typeof definedTermSchema>;

export const contractKeyDateSchema = z
  .object({
    label: trimmedStringSchema,
    rawValue: trimmedStringSchema,
    normalizedValue: trimmedStringSchema.nullable(),
    source: sourceLineRangeSchema,
  })
  .strict();
export type ContractKeyDate = z.infer<typeof contractKeyDateSchema>;

export const contractContextSchema = z
  .object({
    parties: z.array(contractPartySchema).default([]),
    definedTerms: z.array(definedTermSchema).default([]),
    keyDates: z.array(contractKeyDateSchema).default([]),
  })
  .strict();
export type ContractContext = z.infer<typeof contractContextSchema>;

export const candidateWindowSchema = z
  .object({
    id: trimmedStringSchema,
    contextSpans: z.array(sourceLineRangeSchema).default([]),
    targetSpans: z.array(sourceLineRangeSchema).min(1),
    sectionPath: z.array(trimmedStringSchema).default([]),
    cueTypes: z.array(trimmedStringSchema).default([]),
    characterCount: z.number().int().nonnegative(),
    sourceMethod: candidateWindowSourceMethodSchema,
  })
  .strict();
export type CandidateWindow = z.infer<typeof candidateWindowSchema>;

const unresolvedPartyResolutionMethods = new Set<PartyResolutionMethod>([
  "AMBIGUOUS",
  "UNRESOLVED",
]);

export const partyResolutionSchema = z
  .object({
    explicitText: trimmedStringSchema.nullable(),
    roleLabel: trimmedStringSchema.nullable(),
    canonicalName: trimmedStringSchema.nullable(),
    resolutionMethod: partyResolutionMethodSchema,
    supportingEvidence: z.array(evidenceSpanCandidateSchema).default([]),
    confidence: confidenceSchema,
    reviewReasons: z.array(trimmedStringSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (!unresolvedPartyResolutionMethods.has(value.resolutionMethod) && value.roleLabel === null) {
      context.addIssue({
        code: "custom",
        path: ["roleLabel"],
        message: "Resolved party resolutions require a roleLabel",
      });
    }
  });
export type PartyResolution = z.infer<typeof partyResolutionSchema>;

export const rawObligationCandidateSchema = z
  .object({
    businessType: obligationBusinessTypeSchema,
    timingType: obligationTimingTypeSchema,
    responsibleParty: partyResolutionSchema,
    counterparty: partyResolutionSchema.nullable(),
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
    evidenceSpans: z.array(evidenceSpanCandidateSchema).min(1),
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
export type RawObligationCandidate = z.infer<typeof rawObligationCandidateSchema>;

export const verifiedEvidenceSpanSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    evidenceRole: evidenceRoleSchema,
    exactQuote: trimmedStringSchema,
    normalizedQuote: trimmedStringSchema,
    verificationErrors: z.array(trimmedStringSchema).default([]),
  })
  .strict()
  .superRefine(validateSinglePageRange);
export type VerifiedEvidenceSpan = z.infer<typeof verifiedEvidenceSpanSchema>;

export const verifiedObligationCandidateSchema = z
  .object({
    businessType: obligationBusinessTypeSchema,
    timingType: obligationTimingTypeSchema,
    responsibleParty: partyResolutionSchema,
    counterparty: partyResolutionSchema.nullable(),
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
    verifiedEvidenceSpans: z.array(verifiedEvidenceSpanSchema).min(1),
    confidence: confidenceSchema,
    reviewStatus: extractionReviewStatusSchema,
    reviewReasons: z.array(trimmedStringSchema).default([]),
    stableCandidateKey: trimmedStringSchema,
  })
  .strict();
export type VerifiedObligationCandidate = z.infer<typeof verifiedObligationCandidateSchema>;

export const referenceAwareExtractionResultSchema = z
  .object({
    rawCandidates: z.array(rawObligationCandidateSchema).default([]),
    verifiedCandidates: z.array(verifiedObligationCandidateSchema).default([]),
    confirmed: z.array(verifiedObligationCandidateSchema).default([]),
    reviewRequired: z.array(verifiedObligationCandidateSchema).default([]),
    rejected: z.array(verifiedObligationCandidateSchema).default([]),
  })
  .strict();
export type ReferenceAwareExtractionResult = z.infer<
  typeof referenceAwareExtractionResultSchema
>;
