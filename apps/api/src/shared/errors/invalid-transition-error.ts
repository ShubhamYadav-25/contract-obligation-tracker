import { ApplicationError } from "./application-error.js";

export class InvalidTransitionError extends ApplicationError {
  constructor(message = "Transition is not allowed", details: Record<string, unknown> = {}) {
    super({
      code: "INVALID_STATE_TRANSITION",
      message,
      statusCode: 409,
      details,
    });
  }
}
