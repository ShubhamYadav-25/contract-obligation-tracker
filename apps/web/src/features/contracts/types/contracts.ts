export type ContractProcessingStatus =
  "UPLOADED" | "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "ACTIVE" | "FAILED";

export interface ContractSummary {
  readonly id: string;
  readonly fileName: string;
  readonly status: ContractProcessingStatus;
  readonly uploadedAt: string;
  readonly obligationCount: number;
  readonly candidateCount: number;
}

export interface ContractDetail extends ContractSummary {
  readonly sha256: string;
  readonly processingErrors: readonly string[];
  readonly keyFields: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}
