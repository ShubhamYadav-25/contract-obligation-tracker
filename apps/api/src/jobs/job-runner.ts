import type { JobConfig } from "../config/jobs.js";
import type { Clock } from "../infrastructure/clock/clock.js";
import type { Logger } from "../config/logger.js";
import type { JobRepository } from "./job.repository.js";
import type { BackgroundJob } from "./job.types.js";
import type { ProcessorRegistry } from "./processors/processor-registry.js";
import { getErrorMessage, getRetryDelayMilliseconds, isRetryableJobError } from "./retry-policy.js";

export class JobRunner {
  constructor(
    private readonly jobs: JobRepository,
    private readonly registry: ProcessorRegistry,
    private readonly config: JobConfig,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async runOnce(): Promise<number> {
    await this.jobs.recoverExpiredJobs(this.clock.now());
    const claimedJobs = await this.jobs.claimJobs({
      limit: this.config.batchSize,
      workerId: this.config.workerId,
      lockDurationMilliseconds: this.config.lockDurationMilliseconds,
    });

    await Promise.all(claimedJobs.map((job) => this.execute(job)));
    return claimedJobs.length;
  }

  private async execute(job: BackgroundJob): Promise<void> {
    try {
      const processor = this.registry.get(job.jobType);
      await processor(job);
      await this.jobs.markCompleted({ jobId: job.id, workerId: this.config.workerId });
      this.logger.info("job_completed", { jobId: job.id, jobType: job.jobType });
    } catch (error) {
      const retryable = isRetryableJobError(error);
      const retryDelay = getRetryDelayMilliseconds({
        attemptCount: job.attemptCount,
        baseDelayMilliseconds: this.config.retryBaseDelayMilliseconds,
        maxDelayMilliseconds: this.config.retryMaxDelayMilliseconds,
      });
      const nextAvailableAt = new Date(this.clock.now().getTime() + retryDelay);

      await this.jobs.markFailed({
        jobId: job.id,
        workerId: this.config.workerId,
        errorMessage: getErrorMessage(error),
        retryable,
        ...(retryable ? { nextAvailableAt } : {}),
      });

      this.logger.warn("job_failed", {
        jobId: job.id,
        jobType: job.jobType,
        retryable,
        message: getErrorMessage(error),
      });
    }
  }
}
