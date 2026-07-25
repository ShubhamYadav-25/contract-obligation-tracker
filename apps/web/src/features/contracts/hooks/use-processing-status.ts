/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getProcessingStatus } from "../api/get-processing-status.js";

const activeStatuses = new Set([
  "RECEIVED",
  "STORED",
  "QUEUED",
  "PROCESSING",
  "PARSING",
  "OCR_PROCESSING",
]);

/**
 * @description Provides the use processing status hook for React data access or state coordination.
 * @param {string} contractId - Input value for contract id.
 * @returns {unknown} Result of the use processing status operation.
 */
export function useProcessingStatus(contractId: string) {
  return useQuery({
    enabled: contractId.length > 0,
    queryKey: queryKeys.contracts.processingStatus(contractId),
    queryFn: ({ signal }) => getProcessingStatus(contractId, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && activeStatuses.has(status) ? 5_000 : false;
    },
  });
}
