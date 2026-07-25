/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { updateObligation } from "../api/update-obligation.js";

/**
 * @description Provides the use update obligation hook for React data access or state coordination.
 * @param {string} obligationId - Input value for obligation id.
 * @param {string} contractId - Input value for contract id.
 * @returns {unknown} Result of the use update obligation operation.
 */
export function useUpdateObligation(obligationId: string, contractId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateObligation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.detail(obligationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
      if (contractId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.obligations.byContract(contractId),
        });
      }
    },
  });
}
