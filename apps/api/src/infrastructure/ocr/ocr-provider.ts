/**
 * @file Defines OCR infrastructure contracts and adapters.
 */
export interface OcrInput {
  readonly contractId: string;
  readonly documentId: string;
  readonly pageNumber: number;
  readonly fileBytes: Uint8Array;
  readonly pageImageBytes?: Uint8Array;
  readonly pageImageMimeType?: "image/png";
}

export interface OcrResult {
  readonly text: string;
  readonly confidence: number;
  readonly provider: "TESSERACT" | "GEMINI_VISION";
  readonly warnings?: readonly string[];
}

export interface OcrProvider {
  extractPageText(input: OcrInput): Promise<OcrResult>;
}
