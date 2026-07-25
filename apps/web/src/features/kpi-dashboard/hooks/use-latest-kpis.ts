/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { getLatestKpiRun } from "../api/get-latest-kpi-run.js";

/**
 * @description Provides the use latest kpis hook for React data access or state coordination.
 * @returns {unknown} Result of the use latest kpis operation.
 */
export function useLatestKpis() {
  return useQuery({
    queryKey: queryKeys.kpis.latest,
    queryFn: ({ signal }) => getLatestKpiRun(signal),
  });
}
