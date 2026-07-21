import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

export const requestCorrelationMiddleware: RequestHandler = (request, response, next) => {
  const inboundCorrelationId = request.header("x-correlation-id");
  const correlationId =
    inboundCorrelationId && inboundCorrelationId.length > 0 ? inboundCorrelationId : randomUUID();

  response.locals.correlationId = correlationId;
  response.setHeader("x-correlation-id", correlationId);
  next();
};
