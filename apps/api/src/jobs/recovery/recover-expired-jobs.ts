import type { Clock } from "../../infrastructure/clock/clock.js";
import type { AuditService } from "../../modules/audit/audit.service.js";
import type { JobRepository } from "../job.repository.js";

export class RecoverExpiredJobs {
  constructor(
    private readonly jobs: JobRepository,
    private readonly clock: Clock,
    private readonly audit?: AuditService,
  ) {}

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
