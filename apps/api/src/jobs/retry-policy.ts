export class PermanentJobError extends Error {
  override readonly name = "PermanentJobError";
}

export class RetryableJobError extends Error {
  override readonly name = "RetryableJobError";
}

export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof PermanentJobError) {
    return false;
  }
  if (error instanceof RetryableJobError) {
    return true;
  }
  return true;
}

export function getRetryDelayMilliseconds(input: {
  readonly attemptCount: number;
  readonly baseDelayMilliseconds: number;
  readonly maxDelayMilliseconds: number;
}): number {
  return Math.min(
    input.baseDelayMilliseconds * 2 ** Math.max(input.attemptCount - 1, 0),
    input.maxDelayMilliseconds,
  );
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
