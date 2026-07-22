import type { DocumentTextExtractionMethod } from "../document-processing/document-processing.types.js";

export type ContractStatus = "DRAFT";

export type ContractDocumentSourceType = "USER_UPLOAD" | "CUAD_SEED";
export type ContractDocumentUploadStatus = "PENDING_UPLOAD" | "STORED" | "UPLOAD_FAILED";

export type ContractProcessingRunStatus =
  | "RECEIVED"
  | "STORED"
  | "QUEUED"
  | "PROCESSING"
  | "PARSING"
  | "OCR_PROCESSING"
  | "TEXT_SEGMENTED"
  | "COMPLETED"
  | "REVIEW_REQUIRED"
  | "FAILED";

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
  readonly uploadStatus: ContractDocumentUploadStatus;
  readonly uploadErrorCode?: string;
  readonly uploadErrorMessage?: string;
  readonly uploadFailedAt?: Date;
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
  readonly errorStage?: string;
  readonly errorMessage?: string;
  readonly errorRetryable?: boolean;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly failedAt?: Date;
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
  readonly status: "STORED";
  readonly uploadStatus: "stored" | "duplicate";
  readonly isDuplicate: boolean;
  readonly duplicate: boolean;
  readonly originalFilename: string;
  readonly mimeType: "application/pdf";
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly createdAt: string;
}

export interface ContractTextSummary {
  readonly pageCount: number;
  readonly segmentCount: number;
  readonly ocrPageCount: number;
}

export interface ContractWorkspaceRecord {
  readonly contract: ContractRecord;
  readonly currentDocument?: ContractDocumentRecord;
  readonly latestProcessingRun?: ContractProcessingRunRecord;
  readonly text: ContractTextSummary;
}

export interface DocumentTextPageRecord {
  readonly organizationId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
  readonly pageNumber: number;
  readonly extractionMethod: DocumentTextExtractionMethod;
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
  readonly createdAt: Date;
}
