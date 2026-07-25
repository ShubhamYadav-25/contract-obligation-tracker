/**
 * @file Defines backend auth module contracts, services, routes, or persistence logic.
 */
import type { RequestHandler } from "express";
import { z } from "zod";

import { ApplicationError } from "../../shared/errors/application-error.js";

export interface AuthenticatedRequestContext {
  readonly userId: string;
  readonly organizationId: string;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthenticatedRequestContext;
    }
  }
}

const contextSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
});

/**
 * @description Performs the require auth context helper operation for this module.
 * @param {unknown} request - Input value for request.
 * @param {unknown} _response - Input value for response.
 * @param {unknown} next - Input value for next.
 * @returns {unknown} Result of the require auth context operation.
 */
export const requireAuthContext: RequestHandler = (request, _response, next) => {
  const parsed = contextSchema.safeParse({
    userId: request.header("x-user-id"),
    organizationId: request.header("x-organization-id"),
  });

  if (!parsed.success) {
    next(
      new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      }),
    );
    return;
  }

  request.authContext = parsed.data;
  next();
};
