/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
export interface ApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
    readonly correlationId: string;
  };
}

export class ApplicationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {{ readonly code: string; readonly message: string; readonly statusCode: number; readonly details?: Record<string, unknown>; }} input - Input value for input.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = new.target.name;
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.details = input.details ?? {};
  }
}
