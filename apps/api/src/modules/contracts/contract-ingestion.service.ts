/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { randomUUID } from "node:crypto";

import type { Logger } from "../../config/logger.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { StorageProvider } from "../../infrastructure/storage/storage-provider.js";
import type { DownloadObjectStreamResult } from "../../infrastructure/storage/storage-provider.js";
import type { AuditRepository } from "../audit/audit.repository.js";
import { ContractIngestionError, isUniqueViolation } from "./contract-ingestion.errors.js";
import {
  type ContractFileValidationConfig,
  type UploadedContractFile,
  validateContractPdfFile,
} from "./contract-file-validator.js";
import { createContractStorageKey } from "./contract-storage-key.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  ContractWorkspaceRepository,
  DocumentTextPageReadRepository,
  ExistingContractDocument,
} from "./contracts.repository.js";
import type { ContractProcessingQueue } from "./contract-processing.queue.js";
import type {
  ContractDocumentRecord,
  ContractDocumentSourceType,
  ContractTrackingResult,
  ContractWorkspaceRecord,
} from "./contracts.types.js";
import { FileHashService } from "./file-hash.service.js";

export interface ContractIngestionInput {
  readonly file?: UploadedContractFile;
  readonly displayName?: string;
  readonly externalRef?: string;
  readonly organizationId: string;
  readonly uploadedBy: string;
  readonly sourceType: ContractDocumentSourceType;
  readonly sourceReference?: string;
  readonly correlationId: string;
}

export interface ContractIngestionDependencies {
  readonly contracts: ContractRepository;
  readonly contractReads?: ContractWorkspaceRepository;
  readonly documents: ContractDocumentRepository;
  readonly documentTextPages?: DocumentTextPageReadRepository;
  readonly processingRuns: ContractProcessingRepository;
  readonly processingQueue: ContractProcessingQueue;
  readonly audit: AuditRepository;
  readonly storage: StorageProvider;
  readonly storageMetadata: {
    readonly provider: string;
    readonly bucket: string;
  };
  readonly fileHash: FileHashService;
  readonly transactions: TransactionManager;
  readonly validation: ContractFileValidationConfig;
  readonly logger: Logger;
}

export interface ContractDocumentStreamResult {
  readonly document: ContractDocumentRecord;
  readonly stream?:
    | DownloadObjectStreamResult
    | {
        readonly statusCode: 416;
        readonly contentRange: string;
        readonly contentLength: 0;
        readonly acceptRanges: "bytes";
      };
}

/**
 * @description Performs the is unsatisfiable range helper operation for this module.
 * @param {string} range - Input value for range.
 * @param {number} fileSizeBytes - Input value for file size bytes.
 * @returns {boolean} Result of the is unsatisfiable range operation.
 */
function isUnsatisfiableRange(range: string, fileSizeBytes: number): boolean {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return true;
  }
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return true;
  }
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    return !Number.isInteger(suffixLength) || suffixLength <= 0;
  }
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : fileSizeBytes - 1;
  return (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSizeBytes
  );
}

/**
 * @description Performs the duplicate result helper operation for this module.
 * @param {ExistingContractDocument} existing - Input value for existing.
 * @returns {ContractTrackingResult} Result of the duplicate result operation.
 */
function duplicateResult(existing: ExistingContractDocument): ContractTrackingResult {
  return {
    contractId: existing.contract.id,
    documentId: existing.document.id,
    processingRunId: existing.processingRun?.id ?? "",
    status: "STORED",
    uploadStatus: "duplicate",
    isDuplicate: true,
    duplicate: true,
    originalFilename: existing.document.originalFilename,
    mimeType: existing.document.mimeType,
    sizeBytes: existing.document.fileSizeBytes,
    checksumSha256: existing.document.fileHashSha256,
    createdAt: existing.document.uploadedAt.toISOString(),
  };
}

/**
 * @description Performs the safe error message helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {string} Result of the safe error message operation.
 */
function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ContractIngestionService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractIngestionDependencies} dependencies - Input value for dependencies.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly dependencies: ContractIngestionDependencies) {}

  /**
   * @description Implements the ingest method for this service or adapter.
   * @param {ContractIngestionInput} input - Input value for input.
   * @returns {Promise<ContractTrackingResult>} Result of the ingest operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async ingest(input: ContractIngestionInput): Promise<ContractTrackingResult> {
    const validatedFile = validateContractPdfFile(input.file, this.dependencies.validation);
    const fileHashSha256 = this.dependencies.fileHash.sha256(validatedFile.body);
    const duplicate = await this.dependencies.documents.findByOrganizationAndHash({
      organizationId: input.organizationId,
      fileHashSha256,
    });

    if (duplicate) {
      await this.recordDeduplicatedUpload(input, duplicate, fileHashSha256);
      return duplicateResult(duplicate);
    }

    const contractId = randomUUID();
    const documentId = randomUUID();
    const processingRunId = randomUUID();
    const displayName = input.displayName?.trim() || validatedFile.sanitizedDisplayName;
    const storageKey = createContractStorageKey({
      organizationId: input.organizationId,
      contractId,
      documentId,
    });

    try {
      await this.createPendingMetadata({
        input,
        contractId,
        documentId,
        displayName,
        storageKey,
        fileHashSha256,
        originalFilename: validatedFile.sanitizedDisplayName,
        sizeBytes: validatedFile.sizeBytes,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winningDuplicate = await this.dependencies.documents.findByOrganizationAndHash({
          organizationId: input.organizationId,
          fileHashSha256,
        });
        if (winningDuplicate) {
          await this.recordDeduplicatedUpload(input, winningDuplicate, fileHashSha256);
          return duplicateResult(winningDuplicate);
        }
      }

      this.dependencies.logger.error("contract_pending_persistence_failed", {
        contractId,
        documentId,
        message: safeErrorMessage(error),
      });
      throw new ContractIngestionError(
        "CONTRACT_PERSISTENCE_FAILED",
        "Contract metadata could not be persisted",
        500,
      );
    }

    try {
      await this.dependencies.storage.upload({
        objectKey: storageKey,
        originalFilename: validatedFile.sanitizedDisplayName,
        mimeType: "application/pdf",
        contentType: "application/pdf",
        body: validatedFile.body,
        sha256: fileHashSha256,
      });
    } catch (error) {
      this.dependencies.logger.error("contract_storage_upload_failed", {
        contractId,
        documentId,
        message: safeErrorMessage(error),
      });
      await this.markUploadFailed({
        actorId: input.uploadedBy,
        contractId,
        documentId,
        correlationId: input.correlationId,
        errorCode: "STORAGE_UPLOAD_FAILED",
        errorMessage: "Contract document could not be stored",
        fileHashSha256,
        fileSizeBytes: validatedFile.sizeBytes,
      });
      throw new ContractIngestionError(
        "STORAGE_UPLOAD_FAILED",
        "Contract document could not be stored",
        502,
      );
    }

    try {
      const storedDocument = await this.finalizeStoredMetadata({
        input,
        contractId,
        documentId,
        processingRunId,
        fileHashSha256,
        fileSizeBytes: validatedFile.sizeBytes,
      });
      await this.queueProcessing({
        organizationId: input.organizationId,
        contractId,
        documentId,
        processingRunId,
      });

      return {
        contractId,
        documentId,
        processingRunId,
        status: "STORED",
        uploadStatus: "stored",
        isDuplicate: false,
        duplicate: false,
        originalFilename: storedDocument.originalFilename,
        mimeType: storedDocument.mimeType,
        sizeBytes: storedDocument.fileSizeBytes,
        checksumSha256: storedDocument.fileHashSha256,
        createdAt: storedDocument.uploadedAt.toISOString(),
      };
    } catch (error) {
      await this.dependencies.storage.delete(storageKey).catch((cleanupError: unknown) => {
        this.dependencies.logger.error("contract_storage_cleanup_failed", {
          contractId,
          documentId,
          message: safeErrorMessage(cleanupError),
        });
      });
      await this.markUploadFailed({
        actorId: input.uploadedBy,
        contractId,
        documentId,
        correlationId: input.correlationId,
        errorCode: "CONTRACT_FINALIZATION_FAILED",
        errorMessage: "Contract metadata could not be finalized",
        fileHashSha256,
        fileSizeBytes: validatedFile.sizeBytes,
      });

      this.dependencies.logger.error("contract_finalization_failed", {
        contractId,
        documentId,
        message: safeErrorMessage(error),
      });
      throw new ContractIngestionError(
        "CONTRACT_PERSISTENCE_FAILED",
        "Contract metadata could not be persisted",
        500,
      );
    }
  }

  /**
   * @description Implements the find processing status method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string }} input - Input value for input.
   * @returns {unknown} Result of the find processing status operation.
   */
  findProcessingStatus(input: { readonly organizationId: string; readonly contractId: string }) {
    return this.dependencies.processingRuns.findLatestByContractId(input);
  }

  /**
   * @description Executes the list contracts operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly limit: number; readonly offset: number; }} input - Input value for input.
   * @returns {unknown} Result of the list contracts operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  listContracts(input: {
    readonly organizationId: string;
    readonly limit: number;
    readonly offset: number;
  }) {
    if (!this.dependencies.contractReads) {
      throw new Error("Contract read repository is not configured");
    }
    return this.dependencies.contractReads.listByOrganization(input);
  }

  /**
   * @description Implements the find contract method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string }} input - Input value for input.
   * @returns {unknown} Result of the find contract operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  findContract(input: { readonly organizationId: string; readonly contractId: string }) {
    if (!this.dependencies.contractReads) {
      throw new Error("Contract read repository is not configured");
    }
    return this.dependencies.contractReads.findByOrganizationAndId(input);
  }

  /**
   * @description Executes the list document text pages operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly contractId: string }} input - Input value for input.
   * @returns {unknown} Result of the list document text pages operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  listDocumentTextPages(input: { readonly organizationId: string; readonly contractId: string }) {
    if (!this.dependencies.documentTextPages) {
      throw new Error("Document text page read repository is not configured");
    }
    return this.dependencies.documentTextPages.listByContract(input);
  }

  /**
   * @description Executes the reprocess contract operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly contractId: string }} input - Input value for input.
   * @returns {Promise<ContractWorkspaceRecord>} Result of the reprocess contract operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async reprocessContract(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<ContractWorkspaceRecord> {
    const workspace = await this.findContract(input);
    if (!workspace || !workspace.currentDocument || workspace.currentDocument.uploadStatus !== "STORED") {
      throw new ContractIngestionError(
        "CONTRACT_NOT_FOUND",
        "Contract document is not stored or ready for processing",
        404,
      );
    }

    const latestRun = workspace.latestProcessingRun;
    if (latestRun && (latestRun.status === "PROCESSING" || latestRun.status === "QUEUED")) {
      throw new ContractIngestionError(
        "CONTRACT_PROCESSING_IN_PROGRESS",
        "Contract is currently being processed",
        409,
      );
    }

    const processingRunId = randomUUID();
    const nextAttemptNumber = (latestRun?.attemptNumber ?? 0) + 1;

    await this.dependencies.transactions.inTransaction(async (transaction) => {
      await this.dependencies.processingRuns.createRun(
        {
          id: processingRunId,
          contractId: input.contractId,
          documentId: workspace.currentDocument!.id,
          status: "RECEIVED",
          attemptNumber: nextAttemptNumber,
        },
        transaction,
      );
    });

    await this.queueProcessing({
      organizationId: input.organizationId,
      contractId: input.contractId,
      documentId: workspace.currentDocument.id,
      processingRunId,
    });

    await this.dependencies.audit.append({
      actor: {
        id: input.organizationId,
        type: "USER",
      },
      action: "CONTRACT_REPROCESSED",
      entityType: "CONTRACT",
      entityId: input.contractId,
      correlationId: randomUUID(),
      timestamp: new Date(),
      newData: {
        contractId: input.contractId,
        documentId: workspace.currentDocument.id,
        processingRunId,
        attemptNumber: nextAttemptNumber,
      },
    });

    const updatedWorkspace = await this.findContract(input);
    if (!updatedWorkspace) {
      throw new ContractIngestionError("CONTRACT_NOT_FOUND", "Contract was not found", 404);
    }

    return updatedWorkspace;
  }

  /**
   * @description Executes the stream current document operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly contractId: string; readonly range?: string; }} input - Input value for input.
   * @returns {Promise<ContractDocumentStreamResult | null>} Result of the stream current document operation.
   */
  async streamCurrentDocument(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly range?: string;
  }): Promise<ContractDocumentStreamResult | null> {
    const contract = await this.findContract(input);
    if (!contract?.currentDocument || contract.currentDocument.uploadStatus !== "STORED") {
      return null;
    }

    if (input.range && isUnsatisfiableRange(input.range, contract.currentDocument.fileSizeBytes)) {
      return {
        document: contract.currentDocument,
        stream: {
          statusCode: 416,
          contentRange: `bytes */${contract.currentDocument.fileSizeBytes}`,
          contentLength: 0,
          acceptRanges: "bytes",
        },
      };
    }

    return {
      document: contract.currentDocument,
      stream: await this.dependencies.storage.downloadStream({
        objectKey: contract.currentDocument.storageKey,
        ...(input.range ? { range: input.range } : {}),
      }),
    };
  }

  /**
   * @description Implements the queue processing method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string; readonly documentId: string; readonly processingRunId: string; }} input - Input value for input.
   * @returns {Promise<void>} Result of the queue processing operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  private async queueProcessing(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly documentId: string;
    readonly processingRunId: string;
  }): Promise<void> {
    try {
      const queueJobId = await this.dependencies.processingQueue.enqueue(input);
      await this.dependencies.processingRuns.markQueued({
        processingRunId: input.processingRunId,
        queueJobId,
      });
    } catch (error) {
      this.dependencies.logger.error("contract_processing_enqueue_failed", {
        contractId: input.contractId,
        documentId: input.documentId,
        processingRunId: input.processingRunId,
        message: safeErrorMessage(error),
      });
      throw new ContractIngestionError(
        "CONTRACT_PERSISTENCE_FAILED",
        "Contract processing job could not be queued",
        500,
      );
    }
  }

  /**
   * @description Executes the create pending metadata operation used by the application workflow.
   * @param {{ readonly input: ContractIngestionInput; readonly contractId: string; readonly documentId: string; readonly displayName: string; readonly storageKey: string; readonly fileHashSha256: string; readonly originalFilename: string; readonly sizeBytes: number; }} input - Input value for input.
   * @returns {Promise<void>} Result of the create pending metadata operation.
   */
  private async createPendingMetadata(input: {
    readonly input: ContractIngestionInput;
    readonly contractId: string;
    readonly documentId: string;
    readonly displayName: string;
    readonly storageKey: string;
    readonly fileHashSha256: string;
    readonly originalFilename: string;
    readonly sizeBytes: number;
  }): Promise<void> {
    await this.dependencies.transactions.inTransaction(async (transaction) => {
      await this.dependencies.contracts.create(
        {
          id: input.contractId,
          organizationId: input.input.organizationId,
          uploadedBy: input.input.uploadedBy,
          displayName: input.displayName,
          ...(input.input.externalRef ? { externalRef: input.input.externalRef } : {}),
        },
        transaction,
      );
      await this.dependencies.documents.createPending(
        {
          id: input.documentId,
          organizationId: input.input.organizationId,
          contractId: input.contractId,
          versionNumber: 1,
          originalFilename: input.originalFilename,
          storageProvider: this.dependencies.storageMetadata.provider,
          storageBucket: this.dependencies.storageMetadata.bucket,
          storageKey: input.storageKey,
          mimeType: "application/pdf",
          fileSizeBytes: input.sizeBytes,
          fileHashSha256: input.fileHashSha256,
          uploadStatus: "PENDING_UPLOAD",
          sourceType: input.input.sourceType,
          ...(input.input.sourceReference ? { sourceReference: input.input.sourceReference } : {}),
          uploadedBy: input.input.uploadedBy,
        },
        transaction,
      );
      await this.dependencies.audit.append(
        {
          actor: { id: input.input.uploadedBy, type: "USER" },
          action: "CONTRACT_UPLOAD_STARTED",
          entityType: "CONTRACT",
          entityId: input.contractId,
          newData: {
            documentId: input.documentId,
            fileSizeBytes: input.sizeBytes,
            fileHashSha256: input.fileHashSha256,
            uploadStatus: "PENDING_UPLOAD",
            sourceType: input.input.sourceType,
          },
          correlationId: input.input.correlationId,
          timestamp: new Date(),
        },
        transaction,
      );
    });
  }

  /**
   * @description Implements the finalize stored metadata method for this service or adapter.
   * @param {{ readonly input: ContractIngestionInput; readonly contractId: string; readonly documentId: string; readonly processingRunId: string; readonly fileHashSha256: string; readonly fileSizeBytes: number; }} input - Input value for input.
   * @returns {Promise<unknown>} Result of the finalize stored metadata operation.
   */
  private async finalizeStoredMetadata(input: {
    readonly input: ContractIngestionInput;
    readonly contractId: string;
    readonly documentId: string;
    readonly processingRunId: string;
    readonly fileHashSha256: string;
    readonly fileSizeBytes: number;
  }) {
    return this.dependencies.transactions.inTransaction(async (transaction) => {
      const storedDocument = await this.dependencies.documents.markStored(
        { documentId: input.documentId },
        transaction,
      );
      await this.dependencies.contracts.assignCurrentDocument(
        { contractId: input.contractId, documentId: input.documentId },
        transaction,
      );
      await this.dependencies.processingRuns.createRun(
        {
          id: input.processingRunId,
          contractId: input.contractId,
          documentId: input.documentId,
          status: "STORED",
          attemptNumber: 1,
        },
        transaction,
      );
      await this.dependencies.audit.append(
        {
          actor: { id: input.input.uploadedBy, type: "USER" },
          action: "CONTRACT_FILE_STORED",
          entityType: "CONTRACT",
          entityId: input.contractId,
          newData: {
            documentId: input.documentId,
            fileSizeBytes: input.fileSizeBytes,
            fileHashSha256: input.fileHashSha256,
            uploadStatus: "STORED",
          },
          correlationId: input.input.correlationId,
          timestamp: new Date(),
        },
        transaction,
      );

      return storedDocument;
    });
  }

  /**
   * @description Implements the record deduplicated upload method for this service or adapter.
   * @param {ContractIngestionInput} input - Input value for input.
   * @param {ExistingContractDocument} existing - Input value for existing.
   * @param {string} fileHashSha256 - Input value for file hash sha256.
   * @returns {Promise<void>} Result of the record deduplicated upload operation.
   */
  private async recordDeduplicatedUpload(
    input: ContractIngestionInput,
    existing: ExistingContractDocument,
    fileHashSha256: string,
  ): Promise<void> {
    await this.dependencies.audit
      .append({
        actor: { id: input.uploadedBy, type: "USER" },
        action: "CONTRACT_UPLOAD_DEDUPLICATED",
        entityType: "CONTRACT",
        entityId: existing.contract.id,
        newData: {
          documentId: existing.document.id,
          fileSizeBytes: existing.document.fileSizeBytes,
          fileHashSha256,
          uploadStatus: existing.document.uploadStatus,
        },
        correlationId: input.correlationId,
        timestamp: new Date(),
      })
      .catch((error: unknown) => {
        this.dependencies.logger.warn("contract_duplicate_audit_failed", {
          contractId: existing.contract.id,
          documentId: existing.document.id,
          message: safeErrorMessage(error),
        });
      });
  }

  /**
   * @description Implements the mark upload failed method for this service or adapter.
   * @param {{ readonly actorId: string; readonly contractId: string; readonly documentId: string; readonly correlationId: string; readonly errorCode: string; readonly errorMessage: string; readonly fileHashSha256: string; readonly fileSizeBytes: number; }} input - Input value for input.
   * @returns {Promise<void>} Result of the mark upload failed operation.
   */
  private async markUploadFailed(input: {
    readonly actorId: string;
    readonly contractId: string;
    readonly documentId: string;
    readonly correlationId: string;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly fileHashSha256: string;
    readonly fileSizeBytes: number;
  }): Promise<void> {
    await this.dependencies.transactions
      .inTransaction(async (transaction) => {
        await this.dependencies.documents.markUploadFailed(
          {
            documentId: input.documentId,
            errorCode: input.errorCode,
            errorMessage: input.errorMessage,
          },
          transaction,
        );
        await this.dependencies.audit.append(
          {
            actor: { id: input.actorId, type: "USER" },
            action: "CONTRACT_UPLOAD_FAILED",
            entityType: "CONTRACT",
            entityId: input.contractId,
            newData: {
              documentId: input.documentId,
              fileSizeBytes: input.fileSizeBytes,
              fileHashSha256: input.fileHashSha256,
              uploadStatus: "UPLOAD_FAILED",
              errorCode: input.errorCode,
            },
            correlationId: input.correlationId,
            timestamp: new Date(),
          },
          transaction,
        );
      })
      .catch((error: unknown) => {
        this.dependencies.logger.error("contract_upload_failure_mark_failed", {
          contractId: input.contractId,
          documentId: input.documentId,
          message: safeErrorMessage(error),
        });
      });
  }
}
