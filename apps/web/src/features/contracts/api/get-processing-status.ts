import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";

export const contractProcessingStatusSchema = z.enum([
  "RECEIVED",
  "STORED",
  "QUEUED",
  "PROCESSING",
  "PARSING",
  "OCR_PROCESSING",
  "TEXT_SEGMENTED",
  "COMPLETED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

export type ContractProcessingStatus = z.infer<typeof contractProcessingStatusSchema>;

export const processingStatusResponseSchema = z.object({
  contractId: z.string(),
  documentId: z.string(),
  processingRunId: z.string(),
  status: contractProcessingStatusSchema,
  attemptNumber: z.number(),
  queueJobId: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorStage: z.string().nullable(),
  errorMessage: z.string().nullable(),
  errorRetryable: z.boolean().nullable(),
  failedAt: z.string().nullable(),
});

export type ProcessingStatusResponse = z.infer<typeof processingStatusResponseSchema>;

export function getProcessingStatus(contractId: string, signal?: AbortSignal) {
  return apiRequest(`/api/v1/contracts/${contractId}/processing-status`, {
    signal,
    responseSchema: processingStatusResponseSchema,
  });
}
