import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { updateObligationStatus } from "../api/update-obligation-status.js";

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
