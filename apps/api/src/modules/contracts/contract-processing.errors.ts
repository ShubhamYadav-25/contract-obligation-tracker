/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
export type ContractProcessingFailureStage =
  "CLAIM" | "DOCUMENT_LOAD" | "PARSE" | "OCR" | "EXTRACTION" | "PERSISTENCE" | "AUDIT" | "PIPELINE";

export interface ContractProcessingFailureDetails {
  readonly code: string;
  readonly stage: ContractProcessingFailureStage;
  readonly retryable: boolean;
  readonly message: string;
}

export class ContractProcessingPipelineError extends Error {
  readonly code: string;
  readonly stage: ContractProcessingFailureStage;
  readonly retryable: boolean;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractProcessingFailureDetails} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: ContractProcessingFailureDetails) {
    super(input.message);
    this.name = "ContractProcessingPipelineError";
    this.code = input.code;
    this.stage = input.stage;
    this.retryable = input.retryable;
  }
}

export class RetryableContractProcessingError extends ContractProcessingPipelineError {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Omit<ContractProcessingFailureDetails, "retryable">} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: Omit<ContractProcessingFailureDetails, "retryable">) {
    super({ ...input, retryable: true });
    this.name = "RetryableContractProcessingError";
  }
}

export class PermanentContractProcessingError extends ContractProcessingPipelineError {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Omit<ContractProcessingFailureDetails, "retryable">} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: Omit<ContractProcessingFailureDetails, "retryable">) {
    super({ ...input, retryable: false });
    this.name = "PermanentContractProcessingError";
  }
}

/**
 * @description Performs the to processing failure helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {ContractProcessingFailureDetails} Result of the to processing failure operation.
 */
export function toProcessingFailure(error: unknown): ContractProcessingFailureDetails {
  if (error instanceof ContractProcessingPipelineError) {
    return {
      code: error.code,
      stage: error.stage,
      retryable: error.retryable,
      message: error.message,
    };
  }

  return {
    code: "UNEXPECTED_PROCESSING_ERROR",
    stage: "PIPELINE",
    retryable: true,
    message: error instanceof Error ? error.message : "Unexpected processing error",
  };
}
