/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import type { ProcessContractJobPayload } from "./contract-processing-job.schema.js";
import { PermanentContractProcessingError } from "./contract-processing.errors.js";

export type ContractProcessingPipelineResult =
  | {
      readonly outcome: "TEXT_SEGMENTED";
      readonly summary?: Record<string, unknown>;
    }
  | {
      readonly outcome: "COMPLETED";
      readonly summary?: Record<string, unknown>;
    }
  | {
      readonly outcome: "REVIEW_REQUIRED";
      readonly reviewItemCount: number;
      readonly summary?: Record<string, unknown>;
    };

export interface ContractProcessingPipeline {
  run(input: ProcessContractJobPayload): Promise<ContractProcessingPipelineResult>;
}

export class PipelineNotConfigured implements ContractProcessingPipeline {
  /**
   * @description Implements the run method for this service or adapter.
   * @param {ProcessContractJobPayload} _input - Input value for input.
   * @returns {Promise<ContractProcessingPipelineResult>} Result of the run operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async run(_input: ProcessContractJobPayload): Promise<ContractProcessingPipelineResult> {
    throw new PermanentContractProcessingError({
      code: "PIPELINE_NOT_CONFIGURED",
      stage: "PIPELINE",
      message: "Contract parsing, OCR, extraction, and persistence pipeline is not configured yet",
    });
  }
}
