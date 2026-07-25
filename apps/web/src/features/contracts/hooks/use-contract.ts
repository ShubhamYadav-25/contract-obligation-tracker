/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getContract } from "../api/get-contract.js";

const terminalStatuses = new Set(["TEXT_SEGMENTED", "COMPLETED", "REVIEW_REQUIRED", "FAILED"]);

/**
 * @description Provides the use contract hook for React data access or state coordination.
 * @param {string} contractId - Input value for contract id.
 * @returns {unknown} Result of the use contract operation.
 */
export function useContract(contractId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(contractId),
    queryFn: ({ signal }) => getContract(contractId, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.processing?.status;
      return status && !terminalStatuses.has(status) ? 5_000 : false;
    },
  });
}
