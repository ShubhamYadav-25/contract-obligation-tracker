/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { apiRequest } from "@/services/api-client.js";

/**
 * @description Executes the reject review candidate operation used by the application workflow.
 * @param {string} candidateId - Input value for candidate id.
 * @param {string} reason - Input value for reason.
 * @returns {unknown} Result of the reject review candidate operation.
 */
export function rejectReviewCandidate(candidateId: string, reason: string) {
  return apiRequest(`/api/reviews/${candidateId}/reject`, {
    method: "POST",
    body: { reason },
  });
}
