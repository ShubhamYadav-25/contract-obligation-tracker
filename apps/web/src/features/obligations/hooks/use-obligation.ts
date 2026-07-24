import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getObligation } from "../api/get-obligation.js";

export function useObligation(obligationId: string) {
  return useQuery({
    queryKey: queryKeys.obligations.detail(obligationId),
    queryFn: ({ signal }) => getObligation(obligationId, signal),
  });
}
