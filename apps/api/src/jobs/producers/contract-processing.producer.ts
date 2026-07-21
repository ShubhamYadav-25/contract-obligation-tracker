import type { JobRepository } from "../job.repository.js";
import { createContractProcessingJobKey } from "../job-keys.js";
import type {
  ContractProcessingQueue,
  ProcessContractJobData,
} from "../../modules/contracts/contract-processing.queue.js";

export class ContractProcessingProducer implements ContractProcessingQueue {
  constructor(private readonly jobs: JobRepository) {}

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
