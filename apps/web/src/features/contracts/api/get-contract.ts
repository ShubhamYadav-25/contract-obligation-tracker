import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";

const contractDetailSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  status: z.enum(["UPLOADED", "QUEUED", "PROCESSING", "REVIEW_REQUIRED", "ACTIVE", "FAILED"]),
  uploadedAt: z.string(),
  obligationCount: z.number(),
  candidateCount: z.number(),
  sha256: z.string(),
  processingErrors: z.array(z.string()),
  keyFields: z.array(z.object({ label: z.string(), value: z.string() })),
});

export function getContract(contractId: string, signal?: AbortSignal) {
  return apiRequest(`/api/contracts/${contractId}`, {
    signal,
    responseSchema: contractDetailSchema,
  });
}
