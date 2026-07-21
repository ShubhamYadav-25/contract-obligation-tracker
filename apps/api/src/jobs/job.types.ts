export const supportedJobTypes = ["PROCESS_CONTRACT", "DELIVER_REMINDER"] as const;

export type SupportedJobType = (typeof supportedJobTypes)[number];
export type JobStatus = "PENDING" | "PROCESSING" | "RETRY_PENDING" | "COMPLETED" | "FAILED";

export interface BackgroundJob<Payload = unknown> {
  readonly id: string;
  readonly jobType: string;
  readonly idempotencyKey: string;
  readonly payload: Payload;
  readonly status: JobStatus;
  readonly priority: number;
  readonly availableAt: Date;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lockedBy?: string | undefined;
  readonly lockedAt?: Date | undefined;
  readonly lockExpiresAt?: Date | undefined;
  readonly lastError?: string | undefined;
  readonly completedAt?: Date | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateBackgroundJobInput {
  readonly jobType: SupportedJobType;
  readonly idempotencyKey: string;
  readonly payload: unknown;
  readonly priority?: number;
  readonly availableAt?: Date;
  readonly maxAttempts?: number;
}

export interface ClaimJobsInput {
  readonly limit: number;
  readonly workerId: string;
  readonly lockDurationMilliseconds: number;
}

export interface CompleteJobInput {
  readonly jobId: string;
  readonly workerId: string;
}

export interface FailJobInput {
  readonly jobId: string;
  readonly workerId: string;
  readonly errorMessage: string;
  readonly retryable: boolean;
  readonly nextAvailableAt?: Date;
}
