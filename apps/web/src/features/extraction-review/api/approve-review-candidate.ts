/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { apiRequest } from "@/services/api-client.js";
import type { ReviewFormValues } from "../schemas/review-form.schema.js";

/**
 * @description Executes the approve review candidate operation used by the application workflow.
 * @param {string} candidateId - Input value for candidate id.
 * @param {ReviewFormValues} input - Input value for input.
 * @returns {unknown} Result of the approve review candidate operation.
 */
export function approveReviewCandidate(candidateId: string, input: ReviewFormValues) {
  return apiRequest(`/api/reviews/${candidateId}/approve`, {
    method: "POST",
    body: input,
  });
}
