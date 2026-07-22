import type { Logger } from "../../config/logger.js";
import type { OcrProvider, OcrResult } from "../../infrastructure/ocr/ocr-provider.js";
import type { StorageProvider } from "../../infrastructure/storage/storage-provider.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../audit/audit.repository.js";
import type {
  DocumentTextExtractionMethod,
  PdfPageRenderer,
  ParsedDocumentPage,
  SegmentedDocumentPage,
} from "../document-processing/document-processing.types.js";
import type { DocumentTextExtractor } from "../document-processing/document-processing.types.js";
import {
  evaluateTextQuality,
  type DocumentTextQualityConfig,
} from "../document-processing/document-quality.js";
import {
  segmentDocumentPages,
  type TextSegmentationConfig,
} from "../document-processing/text-segmentation.js";
import { normalizeExtractedText, splitPageLines } from "../document-processing/text-normalizer.js";
import type { ProcessContractJobPayload } from "./contract-processing-job.schema.js";
import type {
  ContractProcessingPipeline,
  ContractProcessingPipelineResult,
} from "./contract-processing.pipeline.js";
import {
  PermanentContractProcessingError,
  RetryableContractProcessingError,
} from "./contract-processing.errors.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  DocumentTextPageRepository,
} from "./contracts.repository.js";

export interface DocumentTextProcessingConfig {
  readonly quality: DocumentTextQualityConfig;
  readonly segmentation: TextSegmentationConfig;
  readonly ocrTimeoutMilliseconds: number;
  readonly ocrMinConfidence: number;
  readonly ocrRenderScale: number;
  readonly geminiFallbackEnabled: boolean;
}

export interface DocumentTextProcessingPipelineDependencies {
  readonly documents: ContractDocumentRepository;
  readonly processingRuns: ContractProcessingRepository;
  readonly textPages: DocumentTextPageRepository;
  readonly audit: AuditRepository;
  readonly storage: StorageProvider;
  readonly parser: DocumentTextExtractor;
  readonly pageRenderer: PdfPageRenderer;
  readonly tesseractOcr: OcrProvider;
  readonly geminiVisionOcr?: OcrProvider;
  readonly transactions: TransactionManager;
  readonly logger: Logger;
  readonly config: DocumentTextProcessingConfig;
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseFailureCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("password") || normalized.includes("encrypted")) {
    return "PDF_PASSWORD_PROTECTED";
  }
  if (normalized.includes("valid pdf") || normalized.includes("corrupt")) {
    return "PDF_CORRUPTED";
  }
  return "PDF_PARSE_FAILED";
}

function withTimeout<T>(work: Promise<T>, timeoutMilliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OCR timed out"));
    }, timeoutMilliseconds);

    work.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function pageFromOcrResult(
  basePage: ParsedDocumentPage,
  result: OcrResult,
  qualityConfig: DocumentTextQualityConfig,
): ParsedDocumentPage {
  const normalizedText = normalizeExtractedText(result.text);
  const quality = evaluateTextQuality(normalizedText, qualityConfig);
  return {
    ...basePage,
    text: normalizedText,
    lines: splitPageLines(basePage.pageNumber, normalizedText),
    rawText: result.text,
    normalizedText,
    textItems: normalizedText ? [{ pageNumber: basePage.pageNumber, text: normalizedText }] : [],
    charCount: quality.charCount,
    wordCount: quality.wordCount,
    printableRatio: quality.printableRatio,
    extractionMethod: result.provider,
    ocrConfidence: result.confidence,
    warnings: [...quality.warnings, ...(result.warnings ?? [])],
  };
}

function toPersistencePage(page: SegmentedDocumentPage) {
  return {
    pageNumber: page.pageNumber,
    extractionMethod: page.extractionMethod,
    rawText: page.rawText,
    normalizedText: page.normalizedText,
    charCount: page.charCount,
    wordCount: page.wordCount,
    printableRatio: page.printableRatio,
    ...(page.ocrConfidence !== undefined ? { ocrConfidence: page.ocrConfidence } : {}),
    ...(page.dimensions
      ? { pageWidth: page.dimensions.width, pageHeight: page.dimensions.height }
      : {}),
    segments: page.segments.map((segment) => ({ ...segment })),
    warnings: [...page.warnings],
  };
}

export class DocumentTextProcessingPipeline implements ContractProcessingPipeline {
  constructor(private readonly dependencies: DocumentTextProcessingPipelineDependencies) {}

  async run(input: ProcessContractJobPayload): Promise<ContractProcessingPipelineResult> {
    const document = await this.dependencies.documents.findStoredForProcessing(input);
    if (!document) {
      throw new PermanentContractProcessingError({
        code: "DOCUMENT_NOT_PROCESSABLE",
        stage: "DOCUMENT_LOAD",
        message: "Stored contract document was not found or is not processable",
      });
    }

    let fileBytes: Buffer;
    try {
      fileBytes = await this.dependencies.storage.download(document.storageKey);
    } catch (error) {
      throw new RetryableContractProcessingError({
        code: "STORAGE_DOWNLOAD_FAILED",
        stage: "DOCUMENT_LOAD",
        message: safeMessage(error),
      });
    }

    await this.dependencies.transactions.inTransaction(async (transaction) => {
      await this.dependencies.processingRuns.markStage(
        { ...input, status: "PARSING" },
        transaction,
      );
    });

    let parsedPages: readonly ParsedDocumentPage[];
    try {
      const parsed = await this.dependencies.parser.extract({
        contractId: input.contractId,
        documentId: input.documentId,
        storageKey: document.storageKey,
        fileBytes,
        contentType: "application/pdf",
      });
      parsedPages = parsed.pages;
    } catch (error) {
      throw new PermanentContractProcessingError({
        code: parseFailureCode(safeMessage(error)),
        stage: "PARSE",
        message: safeMessage(error),
      });
    }

    if (parsedPages.length === 0) {
      throw new PermanentContractProcessingError({
        code: "PDF_ZERO_PAGES",
        stage: "PARSE",
        message: "PDF contains no pages",
      });
    }

    const pagesRequiringOcr = parsedPages.filter(
      (page) => !evaluateTextQuality(page.normalizedText, this.dependencies.config.quality).usable,
    );

    let processedPages: readonly ParsedDocumentPage[] = parsedPages;
    if (pagesRequiringOcr.length > 0) {
      await this.dependencies.transactions.inTransaction(async (transaction) => {
        await this.dependencies.processingRuns.markStage(
          { ...input, status: "OCR_PROCESSING" },
          transaction,
        );
      });

      processedPages = await this.ocrPages({
        input,
        fileBytes,
        pages: parsedPages,
        pagesRequiringOcr,
      });
    }

    const segmentedPages = segmentDocumentPages(
      processedPages,
      this.dependencies.config.segmentation,
    );

    const emptyPage = segmentedPages.find((page) => page.normalizedText.length === 0);
    if (emptyPage) {
      throw new PermanentContractProcessingError({
        code: "PAGE_TEXT_UNUSABLE",
        stage: emptyPage.extractionMethod === "PDF_TEXT" ? "PARSE" : "OCR",
        message: `Page ${emptyPage.pageNumber} does not contain usable text`,
      });
    }

    try {
      await this.dependencies.transactions.inTransaction(async (transaction) => {
        await this.dependencies.textPages.replacePages(
          {
            ...input,
            pages: segmentedPages.map(toPersistencePage),
          },
          transaction,
        );
        await this.dependencies.processingRuns.markTextSegmented(input, transaction);
        await this.dependencies.audit.append(
          {
            actor: { id: "contract-processing-worker", type: "SYSTEM" },
            action: "CONTRACT_TEXT_SEGMENTED",
            entityType: "CONTRACT",
            entityId: input.contractId,
            newData: {
              documentId: input.documentId,
              processingRunId: input.processingRunId,
              pageCount: segmentedPages.length,
              segmentCount: segmentedPages.reduce((count, page) => count + page.segments.length, 0),
              ocrPageCount: segmentedPages.filter((page) => page.extractionMethod !== "PDF_TEXT")
                .length,
            },
            correlationId: input.processingRunId,
            timestamp: new Date(),
          },
          transaction,
        );
      });
    } catch (error) {
      throw new RetryableContractProcessingError({
        code: "TEXT_PERSISTENCE_FAILED",
        stage: "PERSISTENCE",
        message: safeMessage(error),
      });
    }

    return {
      outcome: "TEXT_SEGMENTED",
      summary: {
        pageCount: segmentedPages.length,
        segmentCount: segmentedPages.reduce((count, page) => count + page.segments.length, 0),
        ocrPageCount: segmentedPages.filter((page) => page.extractionMethod !== "PDF_TEXT").length,
      },
    };
  }

  private async ocrPages(input: {
    readonly input: ProcessContractJobPayload;
    readonly fileBytes: Buffer;
    readonly pages: readonly ParsedDocumentPage[];
    readonly pagesRequiringOcr: readonly ParsedDocumentPage[];
  }): Promise<readonly ParsedDocumentPage[]> {
    const ocrByPage = new Map<number, ParsedDocumentPage>();

    for (const page of input.pagesRequiringOcr) {
      ocrByPage.set(
        page.pageNumber,
        await this.ocrPage({
          input: input.input,
          fileBytes: input.fileBytes,
          page,
        }),
      );
    }

    return input.pages.map((page) => ocrByPage.get(page.pageNumber) ?? page);
  }

  private async ocrPage(input: {
    readonly input: ProcessContractJobPayload;
    readonly fileBytes: Buffer;
    readonly page: ParsedDocumentPage;
  }): Promise<ParsedDocumentPage> {
    let renderedPage: Awaited<ReturnType<PdfPageRenderer["renderPage"]>>;
    try {
      renderedPage = await this.dependencies.pageRenderer.renderPage({
        contractId: input.input.contractId,
        documentId: input.input.documentId,
        fileBytes: input.fileBytes,
        pageNumber: input.page.pageNumber,
        scale: this.dependencies.config.ocrRenderScale,
      });
    } catch (error) {
      throw new RetryableContractProcessingError({
        code: "PAGE_RENDER_FAILED",
        stage: "OCR",
        message: safeMessage(error),
      });
    }

    const tesseractResult = await this.runOcrProvider("TESSERACT", this.dependencies.tesseractOcr, {
      ...input,
      pageImageBytes: renderedPage.imageBytes,
      pageImageMimeType: renderedPage.mimeType,
    });
    if (tesseractResult) {
      return tesseractResult;
    }

    if (this.dependencies.config.geminiFallbackEnabled && this.dependencies.geminiVisionOcr) {
      const geminiResult = await this.runOcrProvider(
        "GEMINI_VISION",
        this.dependencies.geminiVisionOcr,
        {
          ...input,
          pageImageBytes: renderedPage.imageBytes,
          pageImageMimeType: renderedPage.mimeType,
        },
      );
      if (geminiResult) {
        return geminiResult;
      }
    }

    throw new RetryableContractProcessingError({
      code: "OCR_TEXT_UNUSABLE",
      stage: "OCR",
      message: `OCR output for page ${input.page.pageNumber} did not pass quality checks`,
    });
  }

  private async runOcrProvider(
    provider: DocumentTextExtractionMethod,
    ocr: OcrProvider,
    input: {
      readonly input: ProcessContractJobPayload;
      readonly fileBytes: Buffer;
      readonly pageImageBytes: Uint8Array;
      readonly pageImageMimeType: "image/png";
      readonly page: ParsedDocumentPage;
    },
  ): Promise<ParsedDocumentPage | null> {
    try {
      const result = await withTimeout(
        ocr.extractPageText({
          contractId: input.input.contractId,
          documentId: input.input.documentId,
          pageNumber: input.page.pageNumber,
          fileBytes: input.fileBytes,
          pageImageBytes: input.pageImageBytes,
          pageImageMimeType: input.pageImageMimeType,
        }),
        this.dependencies.config.ocrTimeoutMilliseconds,
      );
      const page = pageFromOcrResult(input.page, result, this.dependencies.config.quality);
      const quality = evaluateTextQuality(page.normalizedText, this.dependencies.config.quality);
      const confidenceOk = result.confidence >= this.dependencies.config.ocrMinConfidence;

      if (quality.usable && confidenceOk) {
        return page;
      }

      this.dependencies.logger.warn("ocr_output_rejected", {
        provider,
        contractId: input.input.contractId,
        documentId: input.input.documentId,
        pageNumber: input.page.pageNumber,
        confidence: result.confidence,
        warnings: quality.warnings,
      });
      return null;
    } catch (error) {
      this.dependencies.logger.warn("ocr_provider_failed", {
        provider,
        contractId: input.input.contractId,
        documentId: input.input.documentId,
        pageNumber: input.page.pageNumber,
        message: safeMessage(error),
      });
      return null;
    }
  }
}
