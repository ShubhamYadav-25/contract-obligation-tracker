export interface OcrInput {
  readonly contractId: string;
  readonly fileBytes: Uint8Array;
}

export interface OcrResult {
  readonly text: string;
  readonly confidence: number;
}

export interface OcrProvider {
  extractText(input: OcrInput): Promise<OcrResult>;
}
