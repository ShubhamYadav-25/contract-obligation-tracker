/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listContracts, type ListContractsInput } from "../api/list-contracts.js";

/**
 * @description Provides the use contracts hook for React data access or state coordination.
 * @param {ListContractsInput} input - Input value for input.
 * @returns {unknown} Result of the use contracts operation.
 */
export function useContracts(input: ListContractsInput = {}) {
  const queryInput = {
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.contracts.list(queryInput),
    queryFn: ({ signal }) => listContracts(queryInput, signal),
  });
}
