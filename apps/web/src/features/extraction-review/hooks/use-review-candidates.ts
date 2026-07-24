import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listReviewCandidates } from "../api/list-review-candidates.js";

export function useReviewCandidates() {
  return useQuery({
    queryKey: queryKeys.reviews.all,
    queryFn: ({ signal }) => listReviewCandidates(signal),
  });
}
