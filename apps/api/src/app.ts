import cors from "cors";
import express from "express";

import { registerRoutes } from "./bootstrap/register-routes.js";
import { getCorsOrigin } from "./config/env.js";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { requestCorrelationMiddleware } from "./shared/middleware/request-correlation.middleware.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ credentials: true, origin: getCorsOrigin() }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestCorrelationMiddleware);

  registerRoutes(app);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
