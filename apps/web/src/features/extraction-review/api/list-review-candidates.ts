/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { z } from "zod";

import { apiRequest } from "@/services/api-client.js";

const reviewCandidateSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  title: z.string(),
  description: z.string(),
  confidence: z.number(),
  reviewReasons: z.array(z.string()),
  sourceAnchors: z.array(
    z.object({
      pageNumber: z.number(),
      startLine: z.number(),
      endLine: z.number(),
      quotedText: z.string(),
    }),
  ),
});

export const reviewCandidateListSchema = z.array(reviewCandidateSchema);

/**
 * @description Executes the list review candidates operation used by the application workflow.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the list review candidates operation.
 */
export function listReviewCandidates(signal?: AbortSignal) {
  return apiRequest("/api/reviews", {
    signal,
    responseSchema: reviewCandidateListSchema,
  });
}
