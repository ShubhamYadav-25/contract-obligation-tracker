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
  sizeBytes: z.coerce.number(),
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

export interface ListContractsInput {
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export function listContracts(input: ListContractsInput = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (input.search?.trim()) {
    query.set("search", input.search.trim());
  }
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (input.offset !== undefined) {
    query.set("offset", String(input.offset));
  }

  const path = query.size > 0 ? `/api/v1/contracts?${query.toString()}` : "/api/v1/contracts";

  return apiRequest<readonly ContractSummary[]>(path, {
    signal,
    responseSchema: contractListSchema,
  });
}
