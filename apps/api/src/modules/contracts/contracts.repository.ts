/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ContractDocumentRecord,
  ContractDocumentSourceType,
  ContractDocumentUploadStatus,
  ContractProcessingRunRecord,
  ContractProcessingRunStatus,
  ContractRecord,
  ContractWorkspaceRecord,
  ContractUploadMetadata,
  DocumentTextPageRecord,
} from "./contracts.types.js";

export interface ContractRepository {
  findById(id: string): Promise<ContractRecord | null>;
  findBySha256(sha256: string): Promise<ContractRecord | null>;
  create(input: CreateContractInput, transaction: TransactionContext): Promise<ContractRecord>;
  assignCurrentDocument(
    input: { readonly contractId: string; readonly documentId: string },
    transaction: TransactionContext,
  ): Promise<void>;
}

export interface ContractDocumentRepository {
  findByOrganizationAndHash(input: {
    readonly organizationId: string;
    readonly fileHashSha256: string;
  }): Promise<ExistingContractDocument | null>;
  findStoredForProcessing(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly documentId: string;
  }): Promise<ContractDocumentRecord | null>;
  createPending(
    input: CreateContractDocumentInput,
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord>;
  markStored(
    input: { readonly documentId: string },
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord>;
  markUploadFailed(
    input: {
      readonly documentId: string;
      readonly errorCode: string;
      readonly errorMessage: string;
    },
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord>;
}

export interface ContractProcessingRepository {
  createRun(
    input: CreateContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markQueued(input: {
    readonly processingRunId: string;
    readonly queueJobId: string;
  }): Promise<ContractProcessingRunRecord>;
  findLatestByContractId(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<ContractProcessingRunRecord | null>;
  findById(input: {
    readonly organizationId: string;
    readonly processingRunId: string;
  }): Promise<ContractProcessingRunRecord | null>;
  claimForProcessing(
    input: ClaimContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord | null>;
  markCompleted(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markReviewRequired(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markRetryableFailure(
    input: FailContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markFailed(
    input: FailContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markStage(
    input: MarkContractProcessingStageInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
  markTextSegmented(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord>;
}

export interface DocumentTextPageRepository {
  replacePages(
    input: PersistDocumentTextPagesInput,
    transaction: TransactionContext,
  ): Promise<void>;
}

export interface ContractWorkspaceRepository {
  listByOrganization(input: {
    readonly organizationId: string;
    readonly search?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly ContractWorkspaceRecord[]>;
  findByOrganizationAndId(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<ContractWorkspaceRecord | null>;
}

export interface DocumentTextPageReadRepository {
  listByContract(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<readonly DocumentTextPageRecord[]>;
}

export interface ExistingContractDocument {
  readonly contract: ContractRecord;
  readonly document: ContractDocumentRecord;
  readonly processingRun: ContractProcessingRunRecord | null;
}

export interface CreateContractInput {
  readonly id: string;
  readonly organizationId: string;
  readonly uploadedBy: string;
  readonly displayName: string;
  readonly externalRef?: string;
}

export interface CreateContractDocumentInput {
  readonly id: string;
  readonly organizationId: string;
  readonly contractId: string;
  readonly versionNumber: number;
  readonly originalFilename: string;
  readonly storageProvider: string;
  readonly storageBucket: string;
  readonly storageKey: string;
  readonly mimeType: "application/pdf";
  readonly fileSizeBytes: number;
  readonly fileHashSha256: string;
  readonly uploadStatus: Extract<ContractDocumentUploadStatus, "PENDING_UPLOAD">;
  readonly sourceType: ContractDocumentSourceType;
  readonly sourceReference?: string;
  readonly uploadedBy: string;
}

export interface CreateContractProcessingRunInput {
  readonly id: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly status: ContractProcessingRunStatus;
  readonly attemptNumber: number;
}

export interface ClaimContractProcessingRunInput {
  readonly organizationId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
  readonly queueJobId: string;
  readonly attemptNumber: number;
}

export interface CompleteContractProcessingRunInput {
  readonly organizationId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
}

export interface FailContractProcessingRunInput extends CompleteContractProcessingRunInput {
  readonly errorCode: string;
  readonly errorStage: string;
  readonly retryable: boolean;
  readonly message: string;
}

export interface MarkContractProcessingStageInput extends CompleteContractProcessingRunInput {
  readonly status: Extract<ContractProcessingRunStatus, "PARSING" | "OCR_PROCESSING">;
}

export interface PersistDocumentTextPagesInput extends CompleteContractProcessingRunInput {
  readonly pages: readonly PersistDocumentTextPageInput[];
}

export interface PersistDocumentTextPageInput {
  readonly pageNumber: number;
  readonly extractionMethod: "PDF_TEXT" | "TESSERACT" | "GEMINI_VISION";
  readonly rawText: string;
  readonly normalizedText: string;
  readonly charCount: number;
  readonly wordCount: number;
  readonly printableRatio: number;
  readonly ocrConfidence?: number;
  readonly pageWidth?: number;
  readonly pageHeight?: number;
  readonly segments: readonly Record<string, unknown>[];
  readonly warnings: readonly string[];
}

export interface LegacyContractRepository extends ContractRepository {
  createUploaded(input: {
    readonly metadata: ContractUploadMetadata;
    readonly storageKey: string;
  }): Promise<ContractRecord>;
  updateProcessingStatus(input: {
    readonly id: string;
    readonly expectedVersion: number;
    readonly status: ContractRecord["status"];
  }): Promise<ContractRecord>;
}
