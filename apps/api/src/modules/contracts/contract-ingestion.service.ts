import { randomUUID } from "node:crypto";

import type { Logger } from "../../config/logger.js";
import type { StorageProvider } from "../../infrastructure/storage/storage-provider.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../audit/audit.repository.js";
import type { ContractProcessingQueue } from "./contract-processing.queue.js";
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
  readonly fileHash: FileHashService;
  readonly queue: ContractProcessingQueue;
  readonly transactions: TransactionManager;
  readonly validation: ContractFileValidationConfig;
  readonly logger: Logger;
}

function duplicateResult(existing: ExistingContractDocument): ContractTrackingResult {
  return {
    contractId: existing.contract.id,
    documentId: existing.document.id,
    processingRunId: existing.processingRun?.id ?? "",
    status: existing.processingRun?.status === "QUEUED" ? "QUEUED" : "STORED",
    duplicate: true,
  };
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

    let uploaded = false;
    let storageReference: Awaited<ReturnType<StorageProvider["upload"]>> | null = null;
    try {
      storageReference = await this.dependencies.storage.upload({
        objectKey: storageKey,
        contentType: "application/pdf",
        body: validatedFile.body,
      });
      uploaded = true;
    } catch (error) {
      this.dependencies.logger.error("contract_storage_upload_failed", {
        contractId,
        documentId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ContractIngestionError(
        "STORAGE_UPLOAD_FAILED",
        "Contract document could not be stored",
        502,
      );
    }

    try {
      await this.dependencies.transactions.inTransaction(async (transaction) => {
        await this.dependencies.contracts.create(
          {
            id: contractId,
            organizationId: input.organizationId,
            uploadedBy: input.uploadedBy,
            displayName,
            ...(input.externalRef ? { externalRef: input.externalRef } : {}),
          },
          transaction,
        );
        await this.dependencies.documents.create(
          {
            id: documentId,
            organizationId: input.organizationId,
            contractId,
            versionNumber: 1,
            originalFilename: validatedFile.sanitizedDisplayName,
            storageProvider: storageReference.provider,
            storageBucket: storageReference.bucket,
            storageKey,
            mimeType: "application/pdf",
            fileSizeBytes: validatedFile.sizeBytes,
            fileHashSha256,
            sourceType: input.sourceType,
            ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
            uploadedBy: input.uploadedBy,
          },
          transaction,
        );
        await this.dependencies.contracts.assignCurrentDocument(
          { contractId, documentId },
          transaction,
        );
        await this.dependencies.processingRuns.createRun(
          {
            id: processingRunId,
            contractId,
            documentId,
            status: "STORED",
            attemptNumber: 1,
          },
          transaction,
        );
        await this.dependencies.audit.append(
          {
            actor: { id: input.uploadedBy, type: "USER" },
            action: "CONTRACT_DOCUMENT_UPLOADED",
            entityType: "CONTRACT",
            entityId: contractId,
            newData: {
              documentId,
              originalFilename: validatedFile.sanitizedDisplayName,
              fileSizeBytes: validatedFile.sizeBytes,
              fileHashSha256,
              sourceType: input.sourceType,
            },
            correlationId: input.correlationId,
            timestamp: new Date(),
          },
          transaction,
        );
      });
    } catch (error) {
      if (uploaded) {
        await this.dependencies.storage.delete(storageKey).catch((cleanupError: unknown) => {
          this.dependencies.logger.error("contract_storage_cleanup_failed", {
            contractId,
            documentId,
            message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        });
      }

      if (isUniqueViolation(error)) {
        const winningDuplicate = await this.dependencies.documents.findByOrganizationAndHash({
          organizationId: input.organizationId,
          fileHashSha256,
        });
        if (winningDuplicate) {
          return duplicateResult(winningDuplicate);
        }
      }

      this.dependencies.logger.error("contract_persistence_failed", {
        contractId,
        documentId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ContractIngestionError(
        "CONTRACT_PERSISTENCE_FAILED",
        "Contract metadata could not be persisted",
        500,
      );
    }

    try {
      const queueJobId = await this.dependencies.queue.enqueue({
        processingRunId,
        contractId,
        documentId,
        organizationId: input.organizationId,
      });
      await this.dependencies.processingRuns.markQueued({
        processingRunId,
        queueJobId,
      });

      return {
        contractId,
        documentId,
        processingRunId,
        status: "QUEUED",
        duplicate: false,
      };
    } catch (error) {
      this.dependencies.logger.warn("contract_processing_queue_failed", {
        contractId,
        documentId,
        processingRunId,
        message: error instanceof Error ? error.message : String(error),
      });

      return {
        contractId,
        documentId,
        processingRunId,
        status: "STORED",
        duplicate: false,
      };
    }
  }

  findProcessingStatus(input: { readonly organizationId: string; readonly contractId: string }) {
    return this.dependencies.processingRuns.findLatestByContractId(input);
  }
}
