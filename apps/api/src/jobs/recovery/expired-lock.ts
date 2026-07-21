import type { BackgroundJob } from "../job.types.js";

export function hasExpiredProcessingLease(job: BackgroundJob, now: Date): boolean {
  return (
    job.status === "PROCESSING" &&
    job.lockExpiresAt !== undefined &&
    job.lockExpiresAt.getTime() < now.getTime()
  );
}
