/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
import type { RequestHandler } from "express";

import { NotFoundError } from "../errors/not-found-error.js";

/**
 * @description Performs the not found middleware helper operation for this module.
 * @param {unknown} request - Input value for request.
 * @param {unknown} _response - Input value for response.
 * @param {unknown} next - Input value for next.
 * @returns {unknown} Result of the not found middleware operation.
 */
export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new NotFoundError("Route was not found", { method: request.method, path: request.path }));
};
