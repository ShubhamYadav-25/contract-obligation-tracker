/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import type { Request, Response } from "express";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ContractIngestionService } from "./contract-ingestion.service.js";
import type {
  ContractDocumentRecord,
  ContractProcessingRunRecord,
  ContractWorkspaceRecord,
  DocumentTextPageRecord,
} from "./contracts.types.js";

export type ContractIngestionServiceFactory = () => ContractIngestionService;

/**
 * @description Performs the require context helper operation for this module.
 * @param {Request} request - Input value for request.
 * @returns {unknown} Result of the require context operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function requireContext(request: Request) {
  const context = request.authContext;
  if (!context) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authenticated user and organization context is required",
      statusCode: 401,
    });
  }
  return context;
}

/**
 * @description Performs the parse pagination helper operation for this module.
 * @param {Request["query"]} query - Input value for query.
 * @returns {unknown} Result of the parse pagination operation.
 */
function parsePagination(query: Request["query"]) {
  const rawLimit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : 50;
  const rawOffset = typeof query.offset === "string" ? Number.parseInt(query.offset, 10) : 0;
  const rawSearch = typeof query.search === "string" ? query.search.trim() : "";

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
    ...(rawSearch ? { search: rawSearch.slice(0, 120) } : {}),
  };
}

/**
 * @description Performs the serialize document helper operation for this module.
 * @param {ContractDocumentRecord | undefined} document - Input value for document.
 * @returns {unknown} Result of the serialize document operation.
 */
function serializeDocument(document: ContractDocumentRecord | undefined) {
  if (!document) return null;

  return {
    id: document.id,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    sizeBytes: document.fileSizeBytes,
    checksumSha256: document.fileHashSha256,
    uploadStatus: document.uploadStatus,
    uploadedAt: document.uploadedAt.toISOString(),
  };
}

/**
 * @description Performs the serialize processing run helper operation for this module.
 * @param {ContractProcessingRunRecord | undefined} run - Input value for run.
 * @returns {unknown} Result of the serialize processing run operation.
 */
function serializeProcessingRun(run: ContractProcessingRunRecord | undefined) {
  if (!run) return null;

  return {
    id: run.id,
    documentId: run.documentId,
    status: run.status,
    attemptNumber: run.attemptNumber,
    queueJobId: run.queueJobId ?? null,
    errorCode: run.errorCode ?? null,
    errorStage: run.errorStage ?? null,
    errorMessage: run.errorMessage ?? null,
    errorRetryable: run.errorRetryable ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
    updatedAt: run.updatedAt.toISOString(),
    canReprocess: run.status !== "PROCESSING" && run.status !== "QUEUED",
  };
}

/**
 * @description Performs the serialize workspace helper operation for this module.
 * @param {ContractWorkspaceRecord} record - Input value for record.
 * @returns {unknown} Result of the serialize workspace operation.
 */
function serializeWorkspace(record: ContractWorkspaceRecord) {
  return {
    id: record.contract.id,
    displayName: record.contract.displayName,
    externalRef: record.contract.externalRef ?? null,
    contractStatus: record.contract.status,
    createdAt: record.contract.createdAt.toISOString(),
    updatedAt: record.contract.updatedAt.toISOString(),
    currentDocument: serializeDocument(record.currentDocument),
    processing: serializeProcessingRun(record.latestProcessingRun),
    text: record.text,
    extraction: record.extraction,
  };
}

/**
 * @description Performs the serialize text page helper operation for this module.
 * @param {DocumentTextPageRecord} page - Input value for page.
 * @returns {unknown} Result of the serialize text page operation.
 */
function serializeTextPage(page: DocumentTextPageRecord) {
  return {
    documentId: page.documentId,
    processingRunId: page.processingRunId,
    pageNumber: page.pageNumber,
    extractionMethod: page.extractionMethod,
    normalizedText: page.normalizedText,
    charCount: page.charCount,
    wordCount: page.wordCount,
    printableRatio: page.printableRatio,
    ocrConfidence: page.ocrConfidence ?? null,
    pageWidth: page.pageWidth ?? null,
    pageHeight: page.pageHeight ?? null,
    segments: page.segments,
    warnings: page.warnings,
    createdAt: page.createdAt.toISOString(),
  };
}

/**
 * @description Performs the inline pdf filename helper operation for this module.
 * @param {string} filename - Input value for filename.
 * @returns {string} Result of the inline pdf filename operation.
 */
function inlinePdfFilename(filename: string): string {
  return filename.replace(/["\r\n\\]/g, "_");
}

export class ContractController {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractIngestionServiceFactory} createService - Input value for create service.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly createService: ContractIngestionServiceFactory) {}

  /**
   * @description Implements the ingest method for this service or adapter.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the ingest operation.
   */
  async ingest(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);

    const file = request.file
      ? {
          originalFilename: request.file.originalname,
          mimeType: request.file.mimetype,
          sizeBytes: request.file.size,
          body: request.file.buffer,
        }
      : undefined;

    const displayName =
      typeof request.body.title === "string"
        ? request.body.title
        : typeof request.body.displayName === "string"
          ? request.body.displayName
          : undefined;

    const input = {
      ...(file ? { file } : {}),
      ...(displayName ? { displayName } : {}),
      ...(typeof request.body.externalRef === "string"
        ? { externalRef: request.body.externalRef }
        : {}),
      organizationId: context.organizationId,
      uploadedBy: context.userId,
      sourceType: "USER_UPLOAD",
      correlationId: String(response.locals.correlationId ?? "unknown"),
    } as const;

    const result = await this.createService().ingest(input);

    response.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      data: result,
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  /**
   * @description Executes the list operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the list operation.
   */
  async list(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);
    const pagination = parsePagination(request.query);
    const contracts = await this.createService().listContracts({
      organizationId: context.organizationId,
      ...pagination,
    });

    response.json({
      success: true,
      data: contracts.map(serializeWorkspace),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        ...pagination,
      },
    });
  }

  /**
   * @description Implements the detail method for this service or adapter.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the detail operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async detail(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);
    const contractId = request.params.contractId;
    if (typeof contractId !== "string") {
      throw new ApplicationError({
        code: "INVALID_CONTRACT_ID",
        message: "Contract ID is required",
        statusCode: 400,
      });
    }

    const contract = await this.createService().findContract({
      organizationId: context.organizationId,
      contractId,
    });

    if (!contract) {
      throw new ApplicationError({
        code: "CONTRACT_NOT_FOUND",
        message: "Contract was not found",
        statusCode: 404,
      });
    }

    response.json({
      success: true,
      data: serializeWorkspace(contract),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  /**
   * @description Implements the text pages method for this service or adapter.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the text pages operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async textPages(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);
    const contractId = request.params.contractId;
    if (typeof contractId !== "string") {
      throw new ApplicationError({
        code: "INVALID_CONTRACT_ID",
        message: "Contract ID is required",
        statusCode: 400,
      });
    }

    const contract = await this.createService().findContract({
      organizationId: context.organizationId,
      contractId,
    });

    if (!contract) {
      throw new ApplicationError({
        code: "CONTRACT_NOT_FOUND",
        message: "Contract was not found",
        statusCode: 404,
      });
    }

    const pages = await this.createService().listDocumentTextPages({
      organizationId: context.organizationId,
      contractId,
    });

    response.json({
      success: true,
      data: {
        contractId,
        pages: pages.map(serializeTextPage),
      },
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  /**
   * @description Implements the processing status method for this service or adapter.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the processing status operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async processingStatus(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);

    const contractId = request.params.contractId;
    if (typeof contractId !== "string") {
      throw new ApplicationError({
        code: "INVALID_CONTRACT_ID",
        message: "Contract ID is required",
        statusCode: 400,
      });
    }

    const processingRun = await this.createService().findProcessingStatus({
      organizationId: context.organizationId,
      contractId,
    });

    if (!processingRun) {
      throw new ApplicationError({
        code: "CONTRACT_NOT_FOUND",
        message: "Contract was not found",
        statusCode: 404,
      });
    }

    response.json({
      success: true,
      data: {
        contractId: processingRun.contractId,
        documentId: processingRun.documentId,
        processingRunId: processingRun.id,
        status: processingRun.status,
        attemptNumber: processingRun.attemptNumber,
        queueJobId: processingRun.queueJobId ?? null,
        errorCode: processingRun.errorCode ?? null,
        errorStage: processingRun.errorStage ?? null,
        errorMessage: processingRun.errorMessage ?? null,
        errorRetryable: processingRun.errorRetryable ?? null,
        failedAt: processingRun.failedAt?.toISOString() ?? null,
        canReprocess: processingRun.status !== "PROCESSING" && processingRun.status !== "QUEUED",
      },
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  /**
   * @description Executes the reprocess contract operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the reprocess operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async reprocess(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);
    const contractId = request.params.contractId;
    if (typeof contractId !== "string") {
      throw new ApplicationError({
        code: "INVALID_CONTRACT_ID",
        message: "Contract ID is required",
        statusCode: 400,
      });
    }

    const result = await this.createService().reprocessContract({
      organizationId: context.organizationId,
      contractId,
    });

    response.status(200).json({
      success: true,
      data: serializeWorkspace(result),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  /**
   * @description Executes the stream document operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the stream document operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async streamDocument(request: Request, response: Response): Promise<void> {
    const context = requireContext(request);
    const contractId = request.params.contractId;
    if (typeof contractId !== "string") {
      throw new ApplicationError({
        code: "INVALID_CONTRACT_ID",
        message: "Contract ID is required",
        statusCode: 400,
      });
    }

    const range = request.header("range");
    const result = await this.createService().streamCurrentDocument({
      organizationId: context.organizationId,
      contractId,
      ...(range ? { range } : {}),
    });

    if (!result) {
      throw new ApplicationError({
        code: "CONTRACT_DOCUMENT_NOT_FOUND",
        message: "Stored PDF document was not found for this contract",
        statusCode: 404,
      });
    }

    const { document, stream } = result;
    if (!stream) {
      throw new ApplicationError({
        code: "CONTRACT_DOCUMENT_NOT_FOUND",
        message: "Stored PDF document was not found for this contract",
        statusCode: 404,
      });
    }
    response.status(stream.statusCode);
    response.setHeader("accept-ranges", stream.acceptRanges ?? "bytes");
    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `inline; filename="${inlinePdfFilename(document.originalFilename)}"`,
    );
    if (stream.contentRange) {
      response.setHeader("content-range", stream.contentRange);
    }
    if (stream.contentLength !== undefined) {
      response.setHeader("content-length", String(stream.contentLength));
    } else if (stream.statusCode === 200) {
      response.setHeader("content-length", String(document.fileSizeBytes));
    }

    if (stream.statusCode === 416) {
      response.end();
      return;
    }

    stream.body.on("error", (error) => {
      response.destroy(error);
    });
    stream.body.pipe(response);
  }
}
