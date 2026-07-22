import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import type { OcrProvider } from "../../src/infrastructure/ocr/ocr-provider.js";
import type { StorageProvider } from "../../src/infrastructure/storage/storage-provider.js";
import type {
  TransactionContext,
  TransactionManager,
} from "../../src/infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../../src/modules/audit/audit.repository.js";
import {
  DocumentTextProcessingPipeline,
  type DocumentTextProcessingConfig,
} from "../../src/modules/contracts/document-text-processing.pipeline.js";
import { RetryableContractProcessingError } from "../../src/modules/contracts/contract-processing.errors.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  DocumentTextPageRepository,
  PersistDocumentTextPagesInput,
} from "../../src/modules/contracts/contracts.repository.js";
import type { ParsedDocumentPage } from "../../src/modules/document-processing/document-processing.types.js";
import type { PdfPageRenderer } from "../../src/modules/document-processing/document-processing.types.js";
import { evaluateTextQuality } from "../../src/modules/document-processing/document-quality.js";
import { splitPageLines } from "../../src/modules/document-processing/text-normalizer.js";

const command = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  documentId: "00000000-0000-4000-8000-000000000003",
  processingRunId: "00000000-0000-4000-8000-000000000004",
};

const config: DocumentTextProcessingConfig = {
  quality: {
    minCharacters: 20,
    minWords: 4,
    minPrintableRatio: 0.75,
    maxIsolatedTokenRatio: 0.45,
  },
  segmentation: {
    maxSegmentCharacters: 80,
    lineOverlap: 0,
  },
  ocrTimeoutMilliseconds: 1_000,
  ocrMinConfidence: 40,
  ocrRenderScale: 2,
  geminiFallbackEnabled: true,
};

function page(pageNumber: number, text: string): ParsedDocumentPage {
  const quality = evaluateTextQuality(text, config.quality);
  return {
    documentId: command.documentId,
    pageNumber,
    text,
    lines: splitPageLines(pageNumber, text),
    rawText: text,
    normalizedText: text,
    textItems: text ? [{ pageNumber, text }] : [],
    charCount: quality.charCount,
    wordCount: quality.wordCount,
    printableRatio: quality.printableRatio,
    extractionMethod: "PDF_TEXT",
    warnings: quality.warnings,
  };
}

function setup(input: {
  readonly pages: readonly ParsedDocumentPage[];
  readonly tesseractText?: string;
  readonly tesseractConfidence?: number;
  readonly geminiText?: string;
  readonly persistenceFails?: boolean;
  readonly renderFails?: boolean;
}) {
  let persisted: PersistDocumentTextPagesInput | null = null;
  const documents: ContractDocumentRepository = {
    findByOrganizationAndHash: vi.fn(),
    findStoredForProcessing: vi.fn(async () => ({
      id: command.documentId,
      organizationId: command.organizationId,
      contractId: command.contractId,
      versionNumber: 1,
      originalFilename: "contract.pdf",
      storageProvider: "supabase",
      storageBucket: "contracts",
      storageKey: "organizations/org/contracts/contract/documents/document/original.pdf",
      mimeType: "application/pdf" as const,
      fileSizeBytes: 100,
      fileHashSha256: "a".repeat(64),
      uploadStatus: "STORED" as const,
      sourceType: "USER_UPLOAD" as const,
      uploadedBy: "00000000-0000-4000-8000-000000000005",
      uploadedAt: new Date(),
    })),
    createPending: vi.fn(),
    markStored: vi.fn(),
    markUploadFailed: vi.fn(),
  };
  const processingRuns: ContractProcessingRepository = {
    createRun: vi.fn(),
    markQueued: vi.fn(),
    findLatestByContractId: vi.fn(),
    findById: vi.fn(),
    claimForProcessing: vi.fn(),
    markCompleted: vi.fn(),
    markReviewRequired: vi.fn(),
    markRetryableFailure: vi.fn(),
    markFailed: vi.fn(),
    markStage: vi.fn(async () => ({ status: "PARSING" }) as never),
    markTextSegmented: vi.fn(async () => ({ status: "TEXT_SEGMENTED" }) as never),
  };
  const textPages: DocumentTextPageRepository = {
    replacePages: vi.fn(async (value) => {
      if (input.persistenceFails) {
        throw new Error("database unavailable");
      }
      persisted = value;
    }),
  };
  const parser = {
    extract: vi.fn(async () => ({
      contractId: command.contractId,
      documentId: command.documentId,
      pages: input.pages,
      extractionMethod: "PDF_TEXT" as const,
    })),
  };
  const pageRenderer: PdfPageRenderer = {
    renderPage: vi.fn(async (value) => {
      if (input.renderFails) {
        throw new Error("renderer unavailable");
      }

      return {
        documentId: value.documentId,
        pageNumber: value.pageNumber,
        imageBytes: Buffer.from("png"),
        mimeType: "image/png" as const,
        width: 100,
        height: 200,
      };
    }),
  };
  const tesseractOcr: OcrProvider = {
    extractPageText: vi.fn(async () => ({
      text: input.tesseractText ?? "OCR text contains a readable contract clause.",
      confidence: input.tesseractConfidence ?? 90,
      provider: "TESSERACT" as const,
    })),
  };
  const geminiVisionOcr: OcrProvider = {
    extractPageText: vi.fn(async () => ({
      text: input.geminiText ?? "Gemini fallback readable contract text for this page.",
      confidence: 95,
      provider: "GEMINI_VISION" as const,
    })),
  };
  const storage: StorageProvider = {
    upload: vi.fn(),
    download: vi.fn(async () => Buffer.from("%PDF-1.4\n%%EOF")),
    remove: vi.fn(),
    delete: vi.fn(),
    createSignedUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
  };
  const transactions: TransactionManager = {
    inTransaction: vi.fn(async (work) => work({} as TransactionContext)),
  };
  const audit: AuditRepository = {
    append: vi.fn(),
  };
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const pipeline = new DocumentTextProcessingPipeline({
    documents,
    processingRuns,
    textPages,
    audit,
    storage,
    parser,
    pageRenderer,
    tesseractOcr,
    geminiVisionOcr,
    transactions,
    logger,
    config,
  });

  return {
    geminiVisionOcr,
    pageRenderer,
    persisted: () => persisted,
    pipeline,
    processingRuns,
    tesseractOcr,
  };
}

describe("DocumentTextProcessingPipeline", () => {
  it("segments machine-readable PDF pages without OCR", async () => {
    const firstPage = page(
      1,
      "Section 1. This agreement starts on July 21, 2026.\nPayment is due monthly.",
    );
    const secondPage = page(2, "Section 2. Confidentiality obligations survive termination.");
    const { pageRenderer, persisted, pipeline, tesseractOcr } = setup({
      pages: [firstPage, secondPage],
    });

    const result = await pipeline.run(command);

    expect(result.outcome).toBe("TEXT_SEGMENTED");
    expect(pageRenderer.renderPage).not.toHaveBeenCalled();
    expect(tesseractOcr.extractPageText).not.toHaveBeenCalled();
    expect(persisted()?.pages).toHaveLength(2);
    expect(persisted()?.pages[0]?.segments[0]).toMatchObject({
      documentId: command.documentId,
      pageNumber: 1,
      lineStart: 1,
      extractionMethod: "PDF_TEXT",
    });
  });

  it("runs OCR only for low-quality mixed pages and falls back to Gemini when Tesseract is rejected", async () => {
    const firstPage = page(1, "Section 1. This page has readable embedded PDF text.");
    const scannedPage = page(2, "");
    const { geminiVisionOcr, pageRenderer, persisted, pipeline, tesseractOcr } = setup({
      pages: [firstPage, scannedPage],
      tesseractText: "x",
      tesseractConfidence: 5,
      geminiText: "Section 2. OCR fallback transcribes only page text.",
    });

    await pipeline.run(command);

    expect(pageRenderer.renderPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 2, scale: 2 }),
    );
    expect(tesseractOcr.extractPageText).toHaveBeenCalledTimes(1);
    expect(tesseractOcr.extractPageText).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 2,
        pageImageBytes: expect.any(Buffer),
        pageImageMimeType: "image/png",
      }),
    );
    expect(geminiVisionOcr.extractPageText).toHaveBeenCalledTimes(1);
    expect(persisted()?.pages.map((savedPage) => savedPage.extractionMethod)).toEqual([
      "PDF_TEXT",
      "GEMINI_VISION",
    ]);
  });

  it("rejects low-quality OCR output instead of marking the document successful", async () => {
    const scannedPage = page(1, "");
    const { pipeline, processingRuns } = setup({
      pages: [scannedPage],
      tesseractText: "x",
      tesseractConfidence: 5,
      geminiText: "y",
    });

    await expect(pipeline.run(command)).rejects.toBeInstanceOf(RetryableContractProcessingError);
    expect(processingRuns.markTextSegmented).not.toHaveBeenCalled();
  });

  it("classifies OCR page render failures as retryable processing errors", async () => {
    const scannedPage = page(1, "");
    const { pipeline, processingRuns, tesseractOcr } = setup({
      pages: [scannedPage],
      renderFails: true,
    });

    await expect(pipeline.run(command)).rejects.toMatchObject({
      code: "PAGE_RENDER_FAILED",
      stage: "OCR",
      retryable: true,
    });
    expect(tesseractOcr.extractPageText).not.toHaveBeenCalled();
    expect(processingRuns.markTextSegmented).not.toHaveBeenCalled();
  });

  it("classifies final persistence failures as retryable processing errors", async () => {
    const readablePage = page(1, "Section 1. This agreement has readable text.");
    const { pipeline, processingRuns } = setup({
      pages: [readablePage],
      persistenceFails: true,
    });

    await expect(pipeline.run(command)).rejects.toMatchObject({
      code: "TEXT_PERSISTENCE_FAILED",
      stage: "PERSISTENCE",
      retryable: true,
    });
    expect(processingRuns.markTextSegmented).not.toHaveBeenCalled();
  });
});
