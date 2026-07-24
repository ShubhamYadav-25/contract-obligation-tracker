import { reviewCandidateListSchema } from "./list-review-candidates.js";
import { apiRequest } from "@/services/api-client.js";

export function getReviewCandidate(candidateId: string, signal?: AbortSignal) {
  return apiRequest(`/api/reviews/${candidateId}`, {
    signal,
    responseSchema: reviewCandidateListSchema.element,
  });
}
