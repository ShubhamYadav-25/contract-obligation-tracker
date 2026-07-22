import { createCanvas } from "@napi-rs/canvas";

import type {
  DocumentPageRenderInput,
  PdfPageRenderer,
  RenderedDocumentPage,
} from "../../modules/document-processing/document-processing.types.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import { isProbablyPdf } from "./pdf-validator.js";

interface PdfViewport {
  readonly width: number;
  readonly height: number;
}

interface PdfRenderTask {
  readonly promise: Promise<void>;
}

interface PdfPage {
  getViewport(input: { readonly scale: number }): PdfViewport;
  render(input: { readonly canvasContext: unknown; readonly viewport: PdfViewport }): PdfRenderTask;
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

export class PdfJsPageRendererAdapter implements PdfPageRenderer {
  async renderPage(input: DocumentPageRenderInput): Promise<RenderedDocumentPage> {
    if (!isProbablyPdf(input.fileBytes)) {
      throw new ExternalServiceError("Input is not a valid PDF");
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
      throw new ExternalServiceError("PDF page renderer failed to load document", {
        contractId: input.contractId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (input.pageNumber < 1 || input.pageNumber > document.numPages) {
        throw new ExternalServiceError("PDF page number is out of range", {
          contractId: input.contractId,
          documentId: input.documentId,
          pageNumber: input.pageNumber,
          pageCount: document.numPages,
        });
      }

      const page = await document.getPage(input.pageNumber);
      const viewport = page.getViewport({ scale: input.scale });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport }).promise;

      return {
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        imageBytes: canvas.toBuffer("image/png"),
        mimeType: "image/png",
        width,
        height,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError("PDF page renderer failed", {
        contractId: input.contractId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await loadingTask.destroy();
    }
  }
}
