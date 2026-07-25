/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { z } from "zod";

import { apiRequest } from "@/services/api-client.js";
import type { DocumentTextPage } from "../types/contracts.js";

const extractionMethodSchema = z.enum(["PDF_TEXT", "TESSERACT", "GEMINI_VISION"]);

const textSegmentSchema = z.object({
  documentId: z.string(),
  pageNumber: z.number(),
  lineStart: z.number(),
  lineEnd: z.number(),
  text: z.string(),
  normalizedText: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
  extractionMethod: extractionMethodSchema,
});

const textPageSchema = z.object({
  documentId: z.string(),
  processingRunId: z.string(),
  pageNumber: z.number(),
  extractionMethod: extractionMethodSchema,
  normalizedText: z.string(),
  charCount: z.number(),
  wordCount: z.number(),
  printableRatio: z.number(),
  ocrConfidence: z.number().nullable(),
  pageWidth: z.number().nullable(),
  pageHeight: z.number().nullable(),
  segments: z.array(textSegmentSchema),
  warnings: z.array(z.string()),
  createdAt: z.string(),
});

const textPagesResponseSchema = z.object({
  contractId: z.string(),
  pages: z.array(textPageSchema),
});

export type ContractTextPagesResponse = {
  readonly contractId: string;
  readonly pages: readonly DocumentTextPage[];
};

/**
 * @description Executes the list contract text pages operation used by the application workflow.
 * @param {string} contractId - Input value for contract id.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the list contract text pages operation.
 */
export function listContractTextPages(contractId: string, signal?: AbortSignal) {
  return apiRequest<ContractTextPagesResponse>(`/api/v1/contracts/${contractId}/text-pages`, {
    signal,
    responseSchema: textPagesResponseSchema,
  });
}
