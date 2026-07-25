/**
 * @file Defines backend document processing module contracts, services, routes, or persistence logic.
 */
export interface DocumentExtractionInput {
  readonly contractId: string;
  readonly documentId: string;
  readonly storageKey: string;
  readonly fileBytes: Uint8Array;
  readonly contentType: "application/pdf";
}

export interface DocumentPageRenderInput {
  readonly contractId: string;
  readonly documentId: string;
  readonly fileBytes: Uint8Array;
  readonly pageNumber: number;
  readonly scale: number;
}

export interface RenderedDocumentPage {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly imageBytes: Buffer;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
}

export type DocumentTextExtractionMethod = "PDF_TEXT" | "TESSERACT" | "GEMINI_VISION";

export interface DocumentPageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ParsedDocumentTextItem {
  readonly pageNumber: number;
  readonly text: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface ParsedDocumentLine {
  readonly pageNumber: number;
  readonly lineNumber: number;
  readonly text: string;
}

export interface ParsedDocumentPage {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly text: string;
  readonly lines: readonly ParsedDocumentLine[];
  readonly rawText: string;
  readonly normalizedText: string;
  readonly textItems: readonly ParsedDocumentTextItem[];
  readonly dimensions?: DocumentPageDimensions;
  readonly charCount: number;
  readonly wordCount: number;
  readonly printableRatio: number;
  readonly extractionMethod: DocumentTextExtractionMethod;
  readonly ocrConfidence?: number;
  readonly warnings: readonly string[];
}

export interface ParsedDocument {
  readonly contractId: string;
  readonly documentId: string;
  readonly pages: readonly ParsedDocumentPage[];
  readonly extractionMethod: "PDF_TEXT" | "OCR" | "HYBRID";
}

export interface DocumentTextSegment {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly text: string;
  readonly normalizedText: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly extractionMethod: DocumentTextExtractionMethod;
  readonly boundingBox?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface SegmentedDocumentPage extends ParsedDocumentPage {
  readonly segments: readonly DocumentTextSegment[];
}

export interface DocumentTextExtractor {
  extract(input: DocumentExtractionInput): Promise<ParsedDocument>;
}

export interface PdfPageRenderer {
  renderPage(input: DocumentPageRenderInput): Promise<RenderedDocumentPage>;
}
