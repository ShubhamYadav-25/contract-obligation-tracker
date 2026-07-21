export interface DocumentExtractionInput {
  readonly contractId: string;
  readonly storageKey: string;
  readonly fileBytes: Uint8Array;
  readonly contentType: "application/pdf";
}

export interface ParsedDocumentLine {
  readonly pageNumber: number;
  readonly lineNumber: number;
  readonly text: string;
}

export interface ParsedDocumentPage {
  readonly pageNumber: number;
  readonly text: string;
  readonly lines: readonly ParsedDocumentLine[];
}

export interface ParsedDocument {
  readonly contractId: string;
  readonly pages: readonly ParsedDocumentPage[];
  readonly extractionMethod: "native-pdf" | "ocr" | "hybrid";
}

export interface DocumentTextExtractor {
  extract(input: DocumentExtractionInput): Promise<ParsedDocument>;
}
