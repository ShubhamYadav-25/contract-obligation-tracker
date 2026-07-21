import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { ApplicationError } from "../errors/application-error.js";
import { ValidationAppError } from "../errors/validation-error.js";

interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: unknown;
}

function getCorrelationId(responseLocals: Record<string, unknown>): string {
  const correlationId = responseLocals["correlationId"];
  return typeof correlationId === "string" ? correlationId : "unknown";
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...("cause" in error && error.cause ? { cause: error.cause } : {}),
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
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

export const errorMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  const normalizedError = normalizeError(error);
  const correlationId = getCorrelationId(response.locals);

  console.error(
    JSON.stringify({
      level: "error",
      message: "api_request_failed",
      correlationId,
      method: request.method,
      path: request.originalUrl,
      statusCode: normalizedError.statusCode,
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
      errorDetails: normalizedError.details,
      originalError: serializeError(error),
    }),
  );

  response.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details,
      correlationId,
    },
  });
};
