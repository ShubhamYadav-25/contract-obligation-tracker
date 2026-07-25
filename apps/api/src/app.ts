/**
 * @file Defines backend API application entrypoint or server composition code.
 */
import cors from "cors";
import express from "express";

import { registerRoutes } from "./bootstrap/register-routes.js";
import { getCorsOrigins } from "./config/env.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { requestCorrelationMiddleware } from "./shared/middleware/request-correlation.middleware.js";

/**
 * @description Executes the create app operation used by the application workflow.
 * @returns {express.Express} Result of the create app operation.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ credentials: true, origin: getCorsOrigins() }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestCorrelationMiddleware);

  registerRoutes(app);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
