import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { OcrInput, OcrProvider, OcrResult } from "./ocr-provider.js";

export class TesseractOcrAdapter implements OcrProvider {
  async extractText(input: OcrInput): Promise<OcrResult> {
    throw new ExternalServiceError("Tesseract OCR adapter is not wired yet", {
      contractId: input.contractId,
    });
  }
}
