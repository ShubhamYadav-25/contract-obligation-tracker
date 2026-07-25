/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

/**
 * @description Performs the request correlation middleware helper operation for this module.
 * @param {unknown} request - Input value for request.
 * @param {unknown} response - Input value for response.
 * @param {unknown} next - Input value for next.
 * @returns {unknown} Result of the request correlation middleware operation.
 */
export const requestCorrelationMiddleware: RequestHandler = (request, response, next) => {
  const inboundCorrelationId = request.header("x-correlation-id");
  const correlationId =
    inboundCorrelationId && inboundCorrelationId.length > 0 ? inboundCorrelationId : randomUUID();

  response.locals.correlationId = correlationId;
  response.setHeader("x-correlation-id", correlationId);
  next();
};
