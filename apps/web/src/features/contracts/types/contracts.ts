/**
 * @file Defines feature-level web application code for the contract tracker.
 */
export type ContractProcessingStatus =
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

export type DocumentTextExtractionMethod = "PDF_TEXT" | "TESSERACT" | "GEMINI_VISION";

export interface CurrentDocumentSummary {
  readonly id: string;
  readonly originalFilename: string;
  readonly mimeType: "application/pdf";
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly uploadStatus: "PENDING_UPLOAD" | "STORED" | "UPLOAD_FAILED";
  readonly uploadedAt: string;
}

export interface ContractProcessingSummary {
  readonly id: string;
  readonly documentId: string;
  readonly status: ContractProcessingStatus;
  readonly attemptNumber: number;
  readonly queueJobId: string | null;
  readonly errorCode: string | null;
  readonly errorStage: string | null;
  readonly errorMessage: string | null;
  readonly errorRetryable: boolean | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly updatedAt: string;
  readonly canReprocess?: boolean | undefined;
}

export interface ContractTextSummary {
  readonly pageCount: number;
  readonly segmentCount: number;
  readonly ocrPageCount: number;
}

export interface ContractExtractionSummary {
  readonly provider?: string | undefined;
  readonly confidence?: number | undefined;
  readonly confirmedCount: number;
  readonly reviewRequiredCount: number;
  readonly rejectedCount: number;
  readonly rawCandidateCount?: number | undefined;
  readonly verifiedCandidateCount?: number | undefined;
  readonly duplicateRemovalCount?: number | undefined;
  readonly consolidationCount?: number | undefined;
  readonly llmRequestCount?: number | undefined;
  readonly retryCount?: number | undefined;
}

export interface ContractSummary {
  readonly id: string;
  readonly displayName: string;
  readonly externalRef: string | null;
  readonly contractStatus: "DRAFT";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currentDocument: CurrentDocumentSummary | null;
  readonly processing: ContractProcessingSummary | null;
  readonly text: ContractTextSummary;
  readonly extraction: ContractExtractionSummary;
}

export type ContractDetail = ContractSummary;

export interface DocumentTextSegment {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly text: string;
  readonly normalizedText: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly extractionMethod: DocumentTextExtractionMethod;
}

export interface DocumentTextPage {
  readonly documentId: string;
  readonly processingRunId: string;
  readonly pageNumber: number;
  readonly extractionMethod: DocumentTextExtractionMethod;
  readonly normalizedText: string;
  readonly charCount: number;
  readonly wordCount: number;
  readonly printableRatio: number;
  readonly ocrConfidence: number | null;
  readonly pageWidth: number | null;
  readonly pageHeight: number | null;
  readonly segments: readonly DocumentTextSegment[];
  readonly warnings: readonly string[];
  readonly createdAt: string;
}
