import { z } from "zod";

import { apiRequest } from "@/services/api-client.js";
import { obligationSummarySchema } from "./list-obligations.js";

const obligationDetailSchema = obligationSummarySchema.extend({
  description: z.string(),
  sourceText: z.string(),
  transitionHistory: z.array(
    z.object({
      fromStatus: z.enum(["UPCOMING", "DUE", "MET", "MISSED"]),
      toStatus: z.enum(["UPCOMING", "DUE", "MET", "MISSED"]),
      actor: z.string(),
      occurredAt: z.string(),
    }),
  ),
});

export function getObligation(obligationId: string, signal?: AbortSignal) {
  return apiRequest(`/api/obligations/${obligationId}`, {
    signal,
    responseSchema: obligationDetailSchema,
  });
}
