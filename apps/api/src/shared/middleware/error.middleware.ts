import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { ApplicationError } from "../errors/application-error.js";
import { ValidationAppError } from "../errors/validation-error.js";

function getCorrelationId(responseLocals: Record<string, unknown>): string {
  const correlationId = responseLocals["correlationId"];
  return typeof correlationId === "string" ? correlationId : "unknown";
}

function normalizeError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationAppError("Request validation failed", { issues: error.issues });
  }

  return new ApplicationError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    statusCode: 500,
  });
}

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  const normalizedError = normalizeError(error);

  response.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details,
      correlationId: getCorrelationId(response.locals),
    },
  });
};
