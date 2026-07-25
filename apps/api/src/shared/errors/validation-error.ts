/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
import { ApplicationError } from "./application-error.js";

export class ValidationAppError extends ApplicationError {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {unknown} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(message = "Request validation failed", details: Record<string, unknown> = {}) {
    super({
      code: "VALIDATION_ERROR",
      message,
      statusCode: 400,
      details,
    });
  }
}
