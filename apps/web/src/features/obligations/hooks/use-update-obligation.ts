import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { updateObligation } from "../api/update-obligation.js";

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
