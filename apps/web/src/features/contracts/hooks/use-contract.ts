import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { getContract } from "../api/get-contract.js";

const terminalStatuses = new Set(["ACTIVE", "REVIEW_REQUIRED", "FAILED"]);

export function useContract(contractId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(contractId),
    queryFn: ({ signal }) => getContract(contractId, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !terminalStatuses.has(status) ? 5_000 : false;
    },
  });
}
