/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { reviewCandidateListSchema } from "./list-review-candidates.js";
import { apiRequest } from "@/services/api-client.js";

/**
 * @description Executes the get review candidate operation used by the application workflow.
 * @param {string} candidateId - Input value for candidate id.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the get review candidate operation.
 */
export function getReviewCandidate(candidateId: string, signal?: AbortSignal) {
  return apiRequest(`/api/reviews/${candidateId}`, {
    signal,
    responseSchema: reviewCandidateListSchema.element,
  });
}
