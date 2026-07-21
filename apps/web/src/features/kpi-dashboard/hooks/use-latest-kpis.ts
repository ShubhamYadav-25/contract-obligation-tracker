import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../services/query-keys.js";
import { getLatestKpiRun } from "../api/get-latest-kpi-run.js";

export function useLatestKpis() {
  return useQuery({
    queryKey: queryKeys.kpis.latest,
    queryFn: ({ signal }) => getLatestKpiRun(signal),
  });
}
