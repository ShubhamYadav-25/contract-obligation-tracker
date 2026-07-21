import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { getProcessingStatus } from "../api/get-processing-status.js";

const activeStatuses = new Set(["RECEIVED", "QUEUED", "PROCESSING"]);

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
