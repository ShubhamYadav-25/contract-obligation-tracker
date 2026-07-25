/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { Clock } from "../../infrastructure/clock/clock.js";
import type { AuditService } from "../../modules/audit/audit.service.js";
import type { JobRepository } from "../job.repository.js";

export class RecoverExpiredJobs {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {JobRepository} jobs - Input value for jobs.
   * @param {Clock} clock - Input value for clock.
   * @param {AuditService} audit - Input value for audit.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
    private readonly audit?: AuditService,
  ) {}

  /**
   * @description Implements the recover method for this service or adapter.
   * @returns {Promise<number>} Result of the recover operation.
   */
  async recover(): Promise<number> {
    const recoveredJobs = await this.jobs.recoverExpiredJobs(this.clock.now());

    await Promise.all(
      recoveredJobs.map((job) =>
        this.audit?.append({
          actor: { id: "system", type: "SYSTEM" },
          action: "BACKGROUND_JOB_LOCK_RECOVERED",
          entityType: "background_job",
          entityId: job.id,
          newData: { status: job.status, jobType: job.jobType },
          correlationId: job.id,
        }),
      ),
    );

    return recoveredJobs.length;
  }
}
