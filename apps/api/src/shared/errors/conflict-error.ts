import { ApplicationError } from "./application-error.js";

export class ConflictError extends ApplicationError {
  constructor(message = "Resource conflict", details: Record<string, unknown> = {}) {
    super({
      code: "CONFLICT",
      message,
      statusCode: 409,
      details,
    });
  }
}
