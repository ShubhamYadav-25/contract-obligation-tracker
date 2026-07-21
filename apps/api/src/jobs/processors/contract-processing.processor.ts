import type { ContractProcessingOrchestrator } from "../../modules/contracts/contract-processing-orchestrator.service.js";
import { ContractProcessingPipelineError } from "../../modules/contracts/contract-processing.errors.js";
import { processContractJobPayloadSchema } from "../../modules/contracts/contract-processing-job.schema.js";
import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError, RetryableJobError } from "../retry-policy.js";

export class ContractProcessingProcessor {
  constructor(private readonly orchestrator: ContractProcessingOrchestrator) {}

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
