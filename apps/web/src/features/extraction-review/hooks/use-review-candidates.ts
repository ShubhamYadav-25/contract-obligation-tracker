/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listReviewCandidates } from "../api/list-review-candidates.js";

/**
 * @description Provides the use review candidates hook for React data access or state coordination.
 * @returns {unknown} Result of the use review candidates operation.
 */
export function useReviewCandidates() {
  return useQuery({
    queryKey: queryKeys.reviews.all,
    queryFn: ({ signal }) => listReviewCandidates(signal),
  });
}
