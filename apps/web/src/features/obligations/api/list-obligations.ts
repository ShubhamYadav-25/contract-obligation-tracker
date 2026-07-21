import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";

const obligationStatusSchema = z.enum(["UPCOMING", "DUE", "MET", "MISSED"]);

export const obligationSummarySchema = z.object({
  id: z.string(),
  contractId: z.string(),
  title: z.string(),
  status: obligationStatusSchema,
  dueAt: z.string().optional(),
  version: z.number(),
});

export function listObligations(signal?: AbortSignal) {
  return apiRequest("/api/obligations", {
    signal,
    responseSchema: z.array(obligationSummarySchema),
  });
}
