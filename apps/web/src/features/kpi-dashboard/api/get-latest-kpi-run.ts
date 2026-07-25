/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { z } from "zod";

import { apiRequest } from "@/services/api-client.js";

const kpiMetricSchema = z.object({
  kpi: z.string(),
  target: z.string(),
  actual: z.string().optional(),
  status: z.enum(["PASS", "WARN", "FAIL", "NOT_MEASURED"]),
  sampleSize: z.number().optional(),
  measurementMethod: z.string(),
  measuredAt: z.string().optional(),
});

/**
 * @description Executes the get latest kpi run operation used by the application workflow.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the get latest kpi run operation.
 */
export function getLatestKpiRun(signal?: AbortSignal) {
  return apiRequest("/api/kpi/runs/latest", {
    signal,
    responseSchema: z.array(kpiMetricSchema),
  });
}
