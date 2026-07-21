import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { OcrInput, OcrProvider, OcrResult } from "./ocr-provider.js";

export class GeminiVisionOcrAdapter implements OcrProvider {
  async extractText(input: OcrInput): Promise<OcrResult> {
    throw new ExternalServiceError("Gemini Vision OCR adapter is not wired yet", {
      contractId: input.contractId,
    });
  }
}
