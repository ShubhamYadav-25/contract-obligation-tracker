/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * @description Performs the async route helper operation for this module.
 * @param {(request: Request, response: Response, next: NextFunction) => Promise<void>} handler - Input value for handler.
 * @returns {RequestHandler} Result of the async route operation.
 */
export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
