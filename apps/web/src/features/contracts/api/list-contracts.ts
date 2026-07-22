import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";
import type { ContractSummary } from "../types/contracts.js";

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

const currentDocumentSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploadStatus: z.enum(["PENDING_UPLOAD", "STORED", "UPLOAD_FAILED"]),
  uploadedAt: z.string(),
});

const processingSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  status: contractProcessingStatusSchema,
  attemptNumber: z.number(),
  queueJobId: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorStage: z.string().nullable(),
  errorMessage: z.string().nullable(),
  errorRetryable: z.boolean().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const contractSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  externalRef: z.string().nullable(),
  contractStatus: z.literal("DRAFT"),
  createdAt: z.string(),
  updatedAt: z.string(),
  currentDocument: currentDocumentSchema.nullable(),
  processing: processingSchema.nullable(),
  text: z.object({
    pageCount: z.number(),
    segmentCount: z.number(),
    ocrPageCount: z.number(),
  }),
});

const contractListSchema = z.array(contractSummarySchema);

export function listContracts(signal?: AbortSignal) {
  return apiRequest<readonly ContractSummary[]>("/api/v1/contracts", {
    signal,
    responseSchema: contractListSchema,
  });
}
