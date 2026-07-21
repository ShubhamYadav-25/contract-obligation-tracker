import { ApplicationError } from "./application-error.js";

export class NotFoundError extends ApplicationError {
  constructor(message = "Resource was not found", details: Record<string, unknown> = {}) {
    super({
      code: "NOT_FOUND",
      message,
      statusCode: 404,
      details,
    });
  }
}
