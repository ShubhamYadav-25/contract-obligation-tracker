/**
 * @file Defines frontend custom React hooks for a contract tracker feature.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { retryContractProcessing } from "../api/retry-contract-processing.js";

/**
 * @description Provides a mutation hook to reprocess or retry contract processing.
 * @returns {unknown} Result of the useReprocessContract hook.
 */
export function useReprocessContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: string) => retryContractProcessing(contractId),
    onSuccess: (_, contractId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.processingStatus(contractId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.textPages(contractId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
    },
  });
}
