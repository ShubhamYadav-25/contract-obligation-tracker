import { ApplicationError } from "./application-error.js";

export class ExternalServiceError extends ApplicationError {
  constructor(message = "External service is unavailable", details: Record<string, unknown> = {}) {
    super({
      code: "EXTERNAL_SERVICE_ERROR",
      message,
      statusCode: 502,
      details,
    });
  }
}
