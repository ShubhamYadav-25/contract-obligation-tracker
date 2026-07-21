import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ContractDocumentRecord,
  ContractDocumentSourceType,
  ContractProcessingRunRecord,
  ContractProcessingRunStatus,
  ContractRecord,
  ContractUploadMetadata,
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
  create(
    input: CreateContractDocumentInput,
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
