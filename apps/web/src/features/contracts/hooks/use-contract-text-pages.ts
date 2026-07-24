import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listContractTextPages } from "../api/list-contract-text-pages.js";

export function useContractTextPages(contractId: string, enabled: boolean) {
  return useQuery({
    enabled: enabled && contractId.length > 0,
    queryKey: queryKeys.contracts.textPages(contractId),
    queryFn: ({ signal }) => listContractTextPages(contractId, signal),
  });
}
