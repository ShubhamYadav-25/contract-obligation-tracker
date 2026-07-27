/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import { FakeStructuredLlmClient } from "../../src/infrastructure/llm/fake-structured-llm-client.js";
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
import type {
  ExtractedObligationInput,
  ObligationRepository,
} from "../../src/modules/obligations/obligations.repository.js";
import type { ObligationExtractionProvider } from "../../src/modules/extraction/obligation-extraction.provider.js";
import { ReferenceAwareObligationExtractor } from "../../src/modules/extraction/reference-aware/index.js";
import { ExternalServiceError } from "../../src/shared/errors/external-service-error.js";

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

/**
 * @description Performs the page helper operation for this module.
 * @param {number} pageNumber - Input value for page number.
 * @param {string} text - Input value for text.
 * @returns {ParsedDocumentPage} Result of the page operation.
 */
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

/**
 * @description Performs the setup helper operation for this module.
 * @param {{ readonly pages: readonly ParsedDocumentPage[]; readonly tesseractText?: string; readonly tesseractConfidence?: number; readonly geminiText?: string; readonly obligationExtractor?: ObligationExtractionProvider; readonly persistenceFails?: boolean; readonly renderFails?: boolean; }} input - Input value for input.
 * @returns {unknown} Result of the setup operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function setup(input: {
  readonly pages: readonly ParsedDocumentPage[];
  readonly tesseractText?: string;
  readonly tesseractConfidence?: number;
  readonly geminiText?: string;
  readonly obligationExtractor?: ObligationExtractionProvider;
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
  const obligations: ObligationRepository = {
    listByOrganization: vi.fn(),
    findById: vi.fn(),
    findDetailByOrganizationAndId: vi.fn(),
    updateEditableFields: vi.fn(),
    updateStatus: vi.fn(),
    upsertExtractedForContract: vi.fn(
      async (value: {
        readonly contractId: string;
        readonly obligations: readonly ExtractedObligationInput[];
      }) =>
        value.obligations.map((obligation, index) => ({
          id: `obligation-${index + 1}`,
          contractId: value.contractId,
          title: obligation.title,
          description: obligation.description,
          status: "UPCOMING" as const,
          ...(obligation.dueAt ? { dueAt: obligation.dueAt } : {}),
          sourceAnchors: [],
          version: 0,
        })),
    ),
  };
  const reminders = {
    createForObligations: vi.fn(async () => 0),
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
    downloadStream: vi.fn(),
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
  const pipelineDependencies = {
    documents,
    processingRuns,
    textPages,
    obligations,
    reminders,
    audit,
    storage,
    parser,
    pageRenderer,
    tesseractOcr,
    geminiVisionOcr,
    transactions,
    logger,
    config,
    ...(input.obligationExtractor ? { obligationExtractor: input.obligationExtractor } : {}),
  };
  const pipeline = new DocumentTextProcessingPipeline(pipelineDependencies);

  return {
    geminiVisionOcr,
    obligations,
    reminders,
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
      "Section 1. This agreement starts on July 21, 2026.\nVendor shall deliver monthly reports by 2026-08-15.",
    );
    const secondPage = page(2, "Section 2. Confidentiality obligations survive termination.");
    const { obligations, pageRenderer, persisted, pipeline, reminders, tesseractOcr } = setup({
      pages: [firstPage, secondPage],
    });

    const result = await pipeline.run(command);

    expect(result.outcome).toBe("COMPLETED");
    expect(pageRenderer.renderPage).not.toHaveBeenCalled();
    expect(tesseractOcr.extractPageText).not.toHaveBeenCalled();
    expect(persisted()?.pages).toHaveLength(2);
    expect(obligations.upsertExtractedForContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: command.contractId,
        obligations: expect.arrayContaining([
          expect.objectContaining({
            title: "Vendor shall deliver monthly reports by 2026-08-15.",
            description: "Vendor shall deliver monthly reports by 2026-08-15.",
            dueAt: new Date(Date.UTC(2026, 7, 15)),
          }),
        ]),
      }),
      expect.anything(),
    );
    expect(reminders.createForObligations).toHaveBeenCalledWith(
      {
        obligations: [
          expect.objectContaining({
            id: "obligation-1",
            dueAt: new Date(Date.UTC(2026, 7, 15)),
          }),
        ],
        offsetBeforeDueMinutes: 4_320,
      },
      expect.anything(),
    );
    expect(persisted()?.pages[0]?.segments[0]).toMatchObject({
      documentId: command.documentId,
      pageNumber: 1,
      lineStart: 1,
      extractionMethod: "PDF_TEXT",
    });
  });

  it("uses the configured obligation extractor and persists its result once", async () => {
    const obligationExtractor: ObligationExtractionProvider = {
      extract: vi.fn(async () => ({
        extraction: {
          obligations: [
            {
              text: "Vendor shall deliver monthly reports by 2026-08-15.",
              anchor: {
                page_number: 1,
                line_offset: 1,
                quoted_text: "Vendor shall deliver monthly reports by 2026-08-15.",
                start_line: 2,
                end_line: 2,
                source: "groq_obligation",
              },
            },
          ],
        },
        confidence: 0.9,
        provider: "GROQ" as const,
      })),
    };
    const firstPage = page(
      1,
      "Section 1. This agreement starts on July 21, 2026.\nVendor shall deliver monthly reports by 2026-08-15.",
    );
    const { obligations, pipeline } = setup({
      pages: [firstPage],
      obligationExtractor,
    });

    const result = await pipeline.run(command);

    expect(result.summary?.obligationCount).toBe(1);
    expect(obligationExtractor.extract).toHaveBeenCalledWith({
      pages: [
        {
          pageNumber: 1,
          rawText:
            "Section 1. This agreement starts on July 21, 2026.\nVendor shall deliver monthly reports by 2026-08-15.",
        },
      ],
      segmentedPages: expect.any(Array),
      context: command,
    });
    expect(obligations.upsertExtractedForContract).toHaveBeenCalledTimes(1);
    expect(obligations.upsertExtractedForContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: command.contractId,
        obligations: [
          expect.objectContaining({
            description: "Vendor shall deliver monthly reports by 2026-08-15.",
            anchors: [
              expect.objectContaining({
                source: "groq_obligation",
                pageNumber: 1,
                startLine: 2,
                endLine: 2,
                boxes: expect.arrayContaining([expect.objectContaining({ y: expect.any(Number) })]),
              }),
            ],
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it("persists confirmed and review-required obligations and completes processing", async () => {
    const llm = new FakeStructuredLlmClient();
    llm.queueResponse("contract_context_extraction", {
      parties: [
        {
          roleLabel: "Customer",
          canonicalName: "Beta Affiliate LLC",
          aliases: [],
          sourceSpan: { startLine: 1, endLine: 1 },
        },
      ],
      definedTerms: [],
      keyDates: [],
      sectionHeadings: [],
    });
    llm.queueResponse("obligation_candidate_extraction", {
      candidates: [
        {
          businessType: "PAYMENT",
          timingType: "RELATIVE_DEADLINE",
          responsibleParty: {
            explicitText: "Customer",
            roleLabel: null,
            canonicalName: null,
            resolutionMethod: "CONTRACT_PARTY_MAP",
            supportingEvidence: [{ startLine: 2, endLine: 2, evidenceRole: "ACTOR" }],
            confidence: 0.9,
            reviewReasons: [],
          },
          counterparty: null,
          action: "pay",
          object: "Fees",
          summary: "Customer shall pay the Fees within thirty days.",
          explicitDueDate: null,
          triggerEvent: "invoice receipt",
          referenceDateLabel: null,
          offsetValue: 30,
          offsetUnit: "days",
          offsetDirection: "after",
          frequency: null,
          duration: null,
          referencedTerms: [],
          crossReferences: [],
          evidenceSpans: [
            { startLine: 2, endLine: 2, evidenceRole: "ACTOR" },
            { startLine: 2, endLine: 2, evidenceRole: "ACTION" },
            { startLine: 3, endLine: 3, evidenceRole: "TIMING" },
          ],
          confidence: 0.92,
          reviewRequired: false,
          reviewReasons: [],
        },
        {
          businessType: "PAYMENT",
          timingType: "RELATIVE_DEADLINE",
          responsibleParty: {
            explicitText: "the other party",
            roleLabel: null,
            canonicalName: null,
            resolutionMethod: "UNRESOLVED",
            supportingEvidence: [{ startLine: 2, endLine: 2, evidenceRole: "ACTOR" }],
            confidence: 0.2,
            reviewReasons: ["Other party is ambiguous"],
          },
          counterparty: null,
          action: "pay",
          object: "Fees",
          summary: "The other party shall pay the Fees within thirty days.",
          explicitDueDate: null,
          triggerEvent: "invoice receipt",
          referenceDateLabel: null,
          offsetValue: 30,
          offsetUnit: "days",
          offsetDirection: "after",
          frequency: null,
          duration: null,
          referencedTerms: [],
          crossReferences: [],
          evidenceSpans: [
            { startLine: 2, endLine: 2, evidenceRole: "ACTOR" },
            { startLine: 2, endLine: 2, evidenceRole: "ACTION" },
          ],
          confidence: 0.4,
          reviewRequired: true,
          reviewReasons: ["Other party is ambiguous"],
        },
      ],
    });
    const obligationExtractor = new ReferenceAwareObligationExtractor({
      llm,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });
    const readablePage = page(
      1,
      [
        "This Agreement is between Acme Network Corporation and Beta Affiliate LLC.",
        "Customer shall pay the Fees.",
        "Payment is due within thirty (30) days after receipt of invoice.",
      ].join("\n"),
    );
    const { obligations, pipeline } = setup({
      pages: [readablePage],
      obligationExtractor,
    });

    const result = await pipeline.run(command);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.summary).toMatchObject({
      obligationCount: 2,
      extractionMetadata: {
        metrics: expect.objectContaining({
          confirmed: 1,
          reviewRequired: 1,
        }),
      },
    });
    expect(obligations.upsertExtractedForContract).toHaveBeenCalledWith(
      expect.objectContaining({
        obligations: expect.arrayContaining([
          expect.objectContaining({
            description: "Customer shall pay the Fees within thirty days.",
            anchors: [
              expect.objectContaining({
                source: "reference_aware_obligation",
                obligatedParty: "Beta Affiliate LLC",
              }),
            ],
          }),
          expect.objectContaining({
            description: "The other party shall pay the Fees within thirty days.",
            anchors: [
              expect.objectContaining({
                source: "reference_aware_obligation",
                confidence: expect.objectContaining({
                  reviewStatus: "REVIEW_REQUIRED",
                }),
              }),
            ],
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it("does not silently produce heuristic results when reference-aware extraction fails", async () => {
    const obligationExtractor: ObligationExtractionProvider = {
      extract: vi.fn(async () => {
        throw new ExternalServiceError("Gemini structured LLM request failed", {
          retryable: true,
        });
      }),
    };
    const readablePage = page(1, "Section 1. Vendor shall deliver monthly reports by 2026-08-15.");
    const { obligations, pipeline, processingRuns } = setup({
      pages: [readablePage],
      obligationExtractor,
    });

    await expect(pipeline.run(command)).rejects.toMatchObject({
      code: "OBLIGATION_EXTRACTION_FAILED",
      stage: "EXTRACTION",
      retryable: true,
    });
    expect(obligations.upsertExtractedForContract).not.toHaveBeenCalled();
    expect(processingRuns.markTextSegmented).not.toHaveBeenCalled();
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
