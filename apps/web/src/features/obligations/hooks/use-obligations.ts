import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { listObligations } from "../api/list-obligations.js";

export function useObligations() {
  return useQuery({
    queryKey: queryKeys.obligations.all,
    queryFn: ({ signal }) => listObligations(signal),
  });
}
