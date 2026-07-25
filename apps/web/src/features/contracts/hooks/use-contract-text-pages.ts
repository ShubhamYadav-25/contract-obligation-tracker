/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listContractTextPages } from "../api/list-contract-text-pages.js";

/**
 * @description Provides the use contract text pages hook for React data access or state coordination.
 * @param {string} contractId - Input value for contract id.
 * @param {boolean} enabled - Input value for enabled.
 * @returns {unknown} Result of the use contract text pages operation.
 */
export function useContractTextPages(contractId: string, enabled: boolean) {
  return useQuery({
    enabled: enabled && contractId.length > 0,
    queryKey: queryKeys.contracts.textPages(contractId),
    queryFn: ({ signal }) => listContractTextPages(contractId, signal),
  });
}
