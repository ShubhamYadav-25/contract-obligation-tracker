/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { ContractProcessingOrchestrator } from "../../modules/contracts/contract-processing-orchestrator.service.js";
import { ContractProcessingPipelineError } from "../../modules/contracts/contract-processing.errors.js";
import { processContractJobPayloadSchema } from "../../modules/contracts/contract-processing-job.schema.js";
import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError, RetryableJobError } from "../retry-policy.js";

export class ContractProcessingProcessor {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractProcessingOrchestrator} orchestrator - Input value for orchestrator.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly orchestrator: ContractProcessingOrchestrator) {}

  /**
   * @description Implements the process method for this service or adapter.
   * @param {BackgroundJob} job - Input value for job.
   * @returns {Promise<void>} Result of the process operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async process(job: BackgroundJob): Promise<void> {
    const parsed = processContractJobPayloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      throw new PermanentJobError("Invalid contract processing job payload");
    }

    try {
      await this.orchestrator.processContract({
        ...parsed.data,
        jobId: job.id,
        queueJobId: job.idempotencyKey,
        attemptNumber: job.attemptCount,
      });
    } catch (error) {
      if (error instanceof ContractProcessingPipelineError) {
        if (error.retryable) {
          throw new RetryableJobError(error.message);
        }
        throw new PermanentJobError(error.message);
      }

      throw error;
    }
  }
}
