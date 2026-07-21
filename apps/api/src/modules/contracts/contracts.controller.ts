import type { Request, Response } from "express";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ContractIngestionService } from "./contract-ingestion.service.js";

export type ContractIngestionServiceFactory = () => ContractIngestionService;

export class ContractController {
  constructor(private readonly createService: ContractIngestionServiceFactory) {}

  async ingest(request: Request, response: Response): Promise<void> {
    const context = request.authContext;
    if (!context) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

    const file = request.file
      ? {
          originalFilename: request.file.originalname,
          mimeType: request.file.mimetype,
          sizeBytes: request.file.size,
          body: request.file.buffer,
        }
      : undefined;

    const input = {
      ...(file ? { file } : {}),
      ...(typeof request.body.displayName === "string"
        ? { displayName: request.body.displayName }
        : {}),
      ...(typeof request.body.externalRef === "string"
        ? { externalRef: request.body.externalRef }
        : {}),
      organizationId: context.organizationId,
      uploadedBy: context.userId,
      sourceType: "USER_UPLOAD",
      correlationId: String(response.locals.correlationId ?? "unknown"),
    } as const;

    const result = await this.createService().ingest(input);

    response.status(result.duplicate ? 200 : 202).json({
      success: true,
      data: result,
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }

  async processingStatus(request: Request, response: Response): Promise<void> {
    const context = request.authContext;
    if (!context) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

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
        errorMessage: processingRun.errorMessage ?? null,
      },
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
