import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { listContracts } from "../api/list-contracts.js";

export function useContracts() {
  return useQuery({
    queryKey: queryKeys.contracts.all,
    queryFn: ({ signal }) => listContracts(signal),
  });
}
