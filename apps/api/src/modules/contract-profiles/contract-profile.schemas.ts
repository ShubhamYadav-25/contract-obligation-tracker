import { z } from "zod";

const nullableText = z.string().trim().min(1).max(500).nullable();

const contractProfileObjectSchema = z.object({
    parties: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    contractValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).nullable().default(null),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable().default(null),
    effectiveDate: z.iso.date().nullable().default(null),
    expirationDate: z.iso.date().nullable().default(null),
    renewalType: nullableText.default(null),
    noticePeriodDays: z.number().int().min(0).max(36500).nullable().default(null),
    nextObligationSummary: nullableText.default(null),
    extractionConfidence: z.number().min(0).max(1).nullable().default(null),
  });

function validateDateRange(
  value: {
    readonly effectiveDate?: string | null | undefined;
    readonly expirationDate?: string | null | undefined;
  },
  context: z.RefinementCtx,
) {
    if (
      value.effectiveDate &&
      value.expirationDate &&
      value.expirationDate < value.effectiveDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["expirationDate"],
        message: "Expiration date must not be before effective date",
      });
    }
}

export const contractProfileFieldsSchema =
  contractProfileObjectSchema.superRefine(validateDateRange);

export const updateContractProfileSchema = z
  .object({
    parties: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    contractValue: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).nullable().optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable().optional(),
    effectiveDate: z.iso.date().nullable().optional(),
    expirationDate: z.iso.date().nullable().optional(),
    renewalType: nullableText.optional(),
    noticePeriodDays: z.number().int().min(0).max(36500).nullable().optional(),
    nextObligationSummary: nullableText.optional(),
    extractionConfidence: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required")
  .superRefine(validateDateRange);
