/**
 * @file Defines shared frontend services for API requests, errors, or query keys.
 */
export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly correlationId: string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly correlationId: string | undefined;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {{ readonly status: number; readonly code: string; readonly message: string; readonly details?: Record<string, unknown> | undefined; readonly correlationId?: string | undefined; }} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown> | undefined;
    readonly correlationId?: string | undefined;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? {};
    this.correlationId = input.correlationId;
  }
}

/**
 * @description Performs the is conflict error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {error is ApiError} Result of the is conflict error operation.
 */
export function isConflictError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

/**
 * @description Performs the is permission error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {error is ApiError} Result of the is permission error operation.
 */
export function isPermissionError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
