import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getReviewCandidate } from "../api/get-review-candidate.js";

export function useReviewCandidate(candidateId: string) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(candidateId),
    queryFn: ({ signal }) => getReviewCandidate(candidateId, signal),
  });
}
