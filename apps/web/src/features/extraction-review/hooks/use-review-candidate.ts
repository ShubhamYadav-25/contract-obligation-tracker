/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getReviewCandidate } from "../api/get-review-candidate.js";

/**
 * @description Provides the use review candidate hook for React data access or state coordination.
 * @param {string} candidateId - Input value for candidate id.
 * @returns {unknown} Result of the use review candidate operation.
 */
export function useReviewCandidate(candidateId: string) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(candidateId),
    queryFn: ({ signal }) => getReviewCandidate(candidateId, signal),
  });
}
