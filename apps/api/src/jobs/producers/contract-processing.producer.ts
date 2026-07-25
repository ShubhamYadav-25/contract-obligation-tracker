/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { JobRepository } from "../job.repository.js";
import { createContractProcessingJobKey } from "../job-keys.js";
import type {
  ContractProcessingQueue,
  ProcessContractJobData,
} from "../../modules/contracts/contract-processing.queue.js";

export class ContractProcessingProducer implements ContractProcessingQueue {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {JobRepository} jobs - Input value for jobs.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly jobs: JobRepository) {}

  /**
   * @description Implements the enqueue method for this service or adapter.
   * @param {ProcessContractJobData} input - Input value for input.
   * @returns {Promise<string>} Result of the enqueue operation.
   */
  enqueue(input: ProcessContractJobData): Promise<string> {
    const idempotencyKey = createContractProcessingJobKey(input);
    return this.jobs
      .createJob({
        jobType: "PROCESS_CONTRACT",
        idempotencyKey,
        payload: input,
        maxAttempts: 5,
      })
      .then(() => idempotencyKey);
  }
}
