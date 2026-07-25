/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
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

/**
 * @description Executes the get obligation operation used by the application workflow.
 * @param {string} obligationId - Input value for obligation id.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the get obligation operation.
 */
export function getObligation(obligationId: string, signal?: AbortSignal) {
  return apiRequest(`/api/obligations/${obligationId}`, {
    signal,
    responseSchema: obligationDetailSchema,
  });
}
