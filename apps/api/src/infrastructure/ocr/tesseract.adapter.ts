/**
 * @file Defines OCR infrastructure contracts and adapters.
 */
import { createWorker } from "tesseract.js";

import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { OcrInput, OcrProvider, OcrResult } from "./ocr-provider.js";

export class TesseractOcrAdapter implements OcrProvider {
  /**
   * @description Implements the extract page text method for this service or adapter.
   * @param {OcrInput} input - Input value for input.
   * @returns {Promise<OcrResult>} Result of the extract page text operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async extractPageText(input: OcrInput): Promise<OcrResult> {
    if (!input.pageImageBytes) {
      throw new ExternalServiceError("Rendered page image is required for Tesseract OCR", {
        contractId: input.contractId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
      });
    }

    const worker = await createWorker("eng");

    try {
      const result = await worker.recognize(Buffer.from(input.pageImageBytes));

      return {
        text: result.data.text ?? "",
        confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0,
        provider: "TESSERACT",
      };
    } catch (error) {
      throw new ExternalServiceError("Tesseract OCR failed", {
        contractId: input.contractId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await worker.terminate();
    }
  }
}
