import { randomUUID } from "node:crypto";

import type { Logger } from "../../config/logger.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { StorageProvider } from "../../infrastructure/storage/storage-provider.js";
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
  ExistingContractDocument,
} from "./contracts.repository.js";
import type { ContractDocumentSourceType, ContractTrackingResult } from "./contracts.types.js";
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
  readonly documents: ContractDocumentRepository;
  readonly processingRuns: ContractProcessingRepository;
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

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ContractIngestionService {
  constructor(private readonly dependencies: ContractIngestionDependencies) {}

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

  findProcessingStatus(input: { readonly organizationId: string; readonly contractId: string }) {
    return this.dependencies.processingRuns.findLatestByContractId(input);
  }

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
