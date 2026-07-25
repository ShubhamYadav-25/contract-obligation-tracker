/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
export class PermanentJobError extends Error {
  override readonly name = "PermanentJobError";
}

export class RetryableJobError extends Error {
  override readonly name = "RetryableJobError";
}

/**
 * @description Performs the is retryable job error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {boolean} Result of the is retryable job error operation.
 */
export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof PermanentJobError) {
    return false;
  }
  if (error instanceof RetryableJobError) {
    return true;
  }
  return true;
}

/**
 * @description Executes the get retry delay milliseconds operation used by the application workflow.
 * @param {{ readonly attemptCount: number; readonly baseDelayMilliseconds: number; readonly maxDelayMilliseconds: number; }} input - Input value for input.
 * @returns {number} Result of the get retry delay milliseconds operation.
 */
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

/**
 * @description Executes the get error message operation used by the application workflow.
 * @param {unknown} error - Input value for error.
 * @returns {string} Result of the get error message operation.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
