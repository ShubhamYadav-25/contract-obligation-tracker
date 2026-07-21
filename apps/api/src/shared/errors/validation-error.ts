import { ApplicationError } from "./application-error.js";

export class ValidationAppError extends ApplicationError {
  constructor(message = "Request validation failed", details: Record<string, unknown> = {}) {
    super({
      code: "VALIDATION_ERROR",
      message,
      statusCode: 400,
      details,
    });
  }
}
