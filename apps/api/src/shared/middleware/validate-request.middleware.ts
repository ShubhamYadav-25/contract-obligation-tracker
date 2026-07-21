import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export interface RequestValidationSchemas {
  readonly body?: ZodType;
  readonly params?: ZodType;
  readonly query?: ZodType;
}

export function validateRequest(schemas: RequestValidationSchemas): RequestHandler {
  return (request, _response, next) => {
    if (schemas.body) {
      request.body = schemas.body.parse(request.body);
    }
    if (schemas.params) {
      request.params = schemas.params.parse(request.params) as Record<string, string>;
    }
    if (schemas.query) {
      request.query = schemas.query.parse(request.query) as typeof request.query;
    }
    next();
  };
}
