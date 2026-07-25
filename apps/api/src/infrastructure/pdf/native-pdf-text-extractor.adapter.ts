/**
 * @file Defines PDF validation, text extraction, and rendering infrastructure.
 */
import type {
  DocumentExtractionInput,
  DocumentTextExtractor,
  ParsedDocument,
  ParsedDocumentPage,
} from "../../modules/document-processing/document-processing.types.js";
import { evaluateTextQuality } from "../../modules/document-processing/document-quality.js";
import {
  normalizeExtractedText,
  splitPageLines,
} from "../../modules/document-processing/text-normalizer.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import { isProbablyPdf } from "./pdf-validator.js";

const defaultQualityConfig = {
  minCharacters: 25,
  minWords: 5,
  minPrintableRatio: 0.75,
  maxIsolatedTokenRatio: 0.45,
};

interface PdfTextItem {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
}

interface PdfTextContent {
  readonly items: readonly unknown[];
}

interface PdfViewport {
  readonly width: number;
  readonly height: number;
}

interface PdfPage {
  getTextContent(): Promise<PdfTextContent>;
  getViewport(input: { readonly scale: number }): PdfViewport;
}

interface PdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfLoadingTask {
  readonly promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  getDocument(input: {
    readonly data: Uint8Array;
    readonly disableFontFace: boolean;
    readonly isEvalSupported: boolean;
    readonly useWorkerFetch: boolean;
  }): PdfLoadingTask;
}

/**
 * @description Performs the is text item helper operation for this module.
 * @param {unknown} item - Input value for item.
 * @returns {item is PdfTextItem} Result of the is text item operation.
 */
function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof item.str === "string" &&
    "transform" in item &&
    Array.isArray(item.transform) &&
    "width" in item &&
    typeof item.width === "number" &&
    "height" in item &&
    typeof item.height === "number"
  );
}

/**
 * @description Performs the text items to lines helper operation for this module.
 * @param {readonly PdfTextItem[]} items - Input value for items.
 * @returns {string} Result of the text items to lines operation.
 */
function textItemsToLines(items: readonly PdfTextItem[]): string {
  const sortedItems = [...items].sort((left, right) => {
    const leftY = left.transform[5] ?? 0;
    const rightY = right.transform[5] ?? 0;
    if (Math.abs(rightY - leftY) > 2) {
      return rightY - leftY;
    }
    return (left.transform[4] ?? 0) - (right.transform[4] ?? 0);
  });
  const lines: string[] = [];
  let previousY: number | null = null;

  for (const item of sortedItems) {
    const y = item.transform[5] ?? 0;
    const sameLine = previousY !== null && Math.abs(previousY - y) <= 2;

    if (!sameLine || lines.length === 0) {
      lines.push(item.str);
    } else {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${item.str}`;
    }

    previousY = y;
  }

  return lines.join("\n");
}

export class NativePdfTextExtractorAdapter implements DocumentTextExtractor {
  /**
   * @description Implements the extract method for this service or adapter.
   * @param {DocumentExtractionInput} input - Input value for input.
   * @returns {Promise<ParsedDocument>} Result of the extract operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async extract(input: DocumentExtractionInput): Promise<ParsedDocument> {
    if (!isProbablyPdf(input.fileBytes)) {
      throw new ExternalServiceError("Input is not a valid PDF");
    }

    const pdfHeaderText = Buffer.from(input.fileBytes).toString("latin1", 0, 4096);
    if (/\/Encrypt\b/.test(pdfHeaderText)) {
      throw new ExternalServiceError("Password-protected PDF cannot be parsed", {
        contractId: input.contractId,
        documentId: input.documentId,
      });
    }

    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(input.fileBytes),
      disableFontFace: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    let document: PdfDocument;

    try {
      document = await loadingTask.promise;
    } catch (error) {
      throw new ExternalServiceError("PDF text parser failed", {
        contractId: input.contractId,
        documentId: input.documentId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (document.numPages <= 0) {
        throw new ExternalServiceError("PDF contains no pages", {
          contractId: input.contractId,
          documentId: input.documentId,
        });
      }

      const pages: ParsedDocumentPage[] = [];

      for (let index = 0; index < document.numPages; index += 1) {
        const page = await document.getPage(index + 1);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const pdfTextItems = textContent.items.filter(isTextItem);
        const rawText = textItemsToLines(pdfTextItems);
        const normalizedText = normalizeExtractedText(rawText);
        const quality = evaluateTextQuality(normalizedText, defaultQualityConfig);

        pages.push({
          documentId: input.documentId,
          pageNumber: index + 1,
          text: normalizedText,
          lines: splitPageLines(index + 1, normalizedText),
          rawText,
          normalizedText,
          textItems: pdfTextItems.map((item) => ({
            pageNumber: index + 1,
            text: item.str,
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            width: item.width,
            height: item.height,
          })),
          dimensions: {
            width: viewport.width,
            height: viewport.height,
          },
          charCount: quality.charCount,
          wordCount: quality.wordCount,
          printableRatio: quality.printableRatio,
          extractionMethod: "PDF_TEXT",
          warnings: quality.warnings,
        });
      }

      return {
        contractId: input.contractId,
        documentId: input.documentId,
        pages,
        extractionMethod: "PDF_TEXT",
      };
    } finally {
      await loadingTask.destroy();
    }
  }
}
