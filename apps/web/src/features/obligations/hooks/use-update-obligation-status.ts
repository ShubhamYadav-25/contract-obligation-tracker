/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { updateObligationStatus } from "../api/update-obligation-status.js";

/**
 * @description Provides the use update obligation status hook for React data access or state coordination.
 * @param {string} obligationId - Input value for obligation id.
 * @returns {unknown} Result of the use update obligation status operation.
 */
export function useUpdateObligationStatus(obligationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateObligationStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.detail(obligationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
    },
  });
}
