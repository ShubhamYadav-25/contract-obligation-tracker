import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { listObligations } from "../api/list-obligations.js";

export function useObligations(
  contractId?: string,
  input: { readonly search?: string; readonly limit?: number; readonly offset?: number } = {},
) {
  const queryInput = {
    ...(contractId ? { contractId } : {}),
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.obligations.list(queryInput),
    queryFn: ({ signal }) => listObligations(queryInput, signal),
  });
}
