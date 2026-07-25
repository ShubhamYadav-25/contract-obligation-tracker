/**
 * @file Defines OCR infrastructure contracts and adapters.
 */
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { OcrInput, OcrProvider, OcrResult } from "./ocr-provider.js";

export class GeminiVisionOcrAdapter implements OcrProvider {
  /**
   * @description Implements the extract page text method for this service or adapter.
   * @param {OcrInput} input - Input value for input.
   * @returns {Promise<OcrResult>} Result of the extract page text operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async extractPageText(input: OcrInput): Promise<OcrResult> {
    throw new ExternalServiceError("Gemini Vision OCR adapter is not wired yet", {
      contractId: input.contractId,
      documentId: input.documentId,
      pageNumber: input.pageNumber,
    });
  }
}
