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

export function getLatestKpiRun(signal?: AbortSignal) {
  return apiRequest("/api/kpi/runs/latest", {
    signal,
    responseSchema: z.array(kpiMetricSchema),
  });
}
