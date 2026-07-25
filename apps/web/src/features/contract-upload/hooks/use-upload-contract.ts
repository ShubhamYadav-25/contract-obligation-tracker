/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { uploadContract } from "../api/upload-contract.js";

/**
 * @description Provides the use upload contract hook for React data access or state coordination.
 * @returns {unknown} Result of the use upload contract operation.
 */
export function useUploadContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadContract,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}
