/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { BackgroundJob, SupportedJobType } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";

export type JobProcessor = (job: BackgroundJob) => Promise<void>;

export class ProcessorRegistry {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReadonlyMap<SupportedJobType, JobProcessor>} processors - Input value for processors.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly processors: ReadonlyMap<SupportedJobType, JobProcessor>) {}

  /**
   * @description Executes the get operation used by the application workflow.
   * @param {string} jobType - Input value for job type.
   * @returns {JobProcessor} Result of the get operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  get(jobType: string): JobProcessor {
    const processor = this.processors.get(jobType as SupportedJobType);
    if (!processor) {
      throw new PermanentJobError(`Unsupported job type: ${jobType}`);
    }
    return processor;
  }
}
