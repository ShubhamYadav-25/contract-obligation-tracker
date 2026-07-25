/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { BackgroundJob } from "../job.types.js";

/**
 * @description Performs the has expired processing lease helper operation for this module.
 * @param {BackgroundJob} job - Input value for job.
 * @param {Date} now - Input value for now.
 * @returns {boolean} Result of the has expired processing lease operation.
 */
export function hasExpiredProcessingLease(job: BackgroundJob, now: Date): boolean {
  return (
    job.status === "PROCESSING" &&
    job.lockExpiresAt !== undefined &&
    job.lockExpiresAt.getTime() < now.getTime()
  );
}
