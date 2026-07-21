export type ContractStatus = "DRAFT";

export type ContractDocumentSourceType = "USER_UPLOAD" | "CUAD_SEED";

export type ContractProcessingRunStatus = "RECEIVED" | "STORED" | "QUEUED" | "FAILED";

export interface ContractRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly uploadedBy: string;
  readonly displayName: string;
  readonly externalRef?: string;
  readonly status: ContractStatus;
  readonly currentDocumentId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContractDocumentRecord {
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
  readonly uploadedAt: Date;
}

export interface ContractProcessingRunRecord {
  readonly id: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly status: ContractProcessingRunStatus;
  readonly attemptNumber: number;
  readonly queueJobId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContractUploadMetadata {
  readonly fileName: string;
  readonly contentType: "application/pdf";
  readonly byteLength: number;
  readonly sha256: string;
}

export interface ContractTrackingResult {
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
  readonly status: "QUEUED" | "STORED";
  readonly duplicate: boolean;
}
