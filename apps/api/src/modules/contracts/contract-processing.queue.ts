export interface ProcessContractJobData {
  readonly processingRunId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly organizationId: string;
}

export interface ContractProcessingQueue {
  enqueue(input: ProcessContractJobData): Promise<string>;
}
