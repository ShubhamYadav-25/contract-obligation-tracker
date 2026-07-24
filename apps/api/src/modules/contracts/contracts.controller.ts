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
  };
}

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

function inlinePdfFilename(filename: string): string {
  return filename.replace(/["\r\n\\]/g, "_");
}

export class ContractController {
  constructor(private readonly createService: ContractIngestionServiceFactory) {}

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
      },
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

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
