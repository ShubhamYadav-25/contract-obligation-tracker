import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";

const contractSummarySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  status: z.enum(["UPLOADED", "QUEUED", "PROCESSING", "REVIEW_REQUIRED", "ACTIVE", "FAILED"]),
  uploadedAt: z.string(),
  obligationCount: z.number(),
  candidateCount: z.number(),
});

const contractListSchema = z.array(contractSummarySchema);

export function listContracts(signal?: AbortSignal) {
  return apiRequest("/api/contracts", {
    signal,
    responseSchema: contractListSchema,
  });
}
