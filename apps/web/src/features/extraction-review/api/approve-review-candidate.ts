import { apiRequest } from "@/services/api-client.js";
import type { ReviewFormValues } from "../schemas/review-form.schema.js";

export function approveReviewCandidate(candidateId: string, input: ReviewFormValues) {
  return apiRequest(`/api/reviews/${candidateId}/approve`, {
    method: "POST",
    body: input,
  });
}
