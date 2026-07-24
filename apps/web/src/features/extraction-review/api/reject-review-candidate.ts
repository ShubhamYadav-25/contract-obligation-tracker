import { apiRequest } from "@/services/api-client.js";

export function rejectReviewCandidate(candidateId: string, reason: string) {
  return apiRequest(`/api/reviews/${candidateId}/reject`, {
    method: "POST",
    body: { reason },
  });
}
