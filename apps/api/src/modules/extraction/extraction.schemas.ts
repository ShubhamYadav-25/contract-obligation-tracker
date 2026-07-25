/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import { z } from "zod";

export const extractedObligationCandidateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.iso.datetime().optional(),
  responsibleParty: z.string().min(1).optional(),
  sourceAnchors: z
    .array(
      z.object({
        pageNumber: z.number().int().positive(),
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
        quotedText: z.string().min(1),
      }),
    )
    .min(1),
});

export const extractionOutputSchema = z.object({
  obligations: z.array(extractedObligationCandidateSchema),
});
