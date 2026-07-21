import type { ApiEnv } from "./env.js";

export interface JobConfig {
  readonly workerId: string;
  readonly pollIntervalMilliseconds: number;
  readonly batchSize: number;
  readonly lockDurationMilliseconds: number;
  readonly maxAttempts: number;
  readonly retryBaseDelayMilliseconds: number;
  readonly retryMaxDelayMilliseconds: number;
}

export function createJobConfig(env: ApiEnv): JobConfig {
  return {
    workerId: env.WORKER_ID,
    pollIntervalMilliseconds: env.JOB_POLL_INTERVAL_MS,
    batchSize: env.JOB_BATCH_SIZE,
    lockDurationMilliseconds: env.JOB_LOCK_DURATION_MS,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    retryBaseDelayMilliseconds: env.JOB_RETRY_BASE_DELAY_MS,
    retryMaxDelayMilliseconds: env.JOB_RETRY_MAX_DELAY_MS,
  };
}
