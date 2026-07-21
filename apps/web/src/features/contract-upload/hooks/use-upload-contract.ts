import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { uploadContract } from "../api/upload-contract.js";

export function useUploadContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadContract,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}
