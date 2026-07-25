/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
export interface ProcessContractJobData {
  readonly processingRunId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly organizationId: string;
}

export interface ContractProcessingQueue {
  enqueue(input: ProcessContractJobData): Promise<string>;
}
