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
