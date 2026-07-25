/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getObligation } from "../api/get-obligation.js";

/**
 * @description Provides the use obligation hook for React data access or state coordination.
 * @param {string} obligationId - Input value for obligation id.
 * @returns {unknown} Result of the use obligation operation.
 */
export function useObligation(obligationId: string) {
  return useQuery({
    queryKey: queryKeys.obligations.detail(obligationId),
    queryFn: ({ signal }) => getObligation(obligationId, signal),
  });
}
