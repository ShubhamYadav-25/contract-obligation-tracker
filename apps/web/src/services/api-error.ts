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

export function isConflictError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

export function isPermissionError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
