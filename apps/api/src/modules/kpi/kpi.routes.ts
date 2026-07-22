import { Router } from "express";

import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { KpiController } from "./kpi.controller.js";

export function createKpiRouter(): Router {
  const router = Router();
  const controller = new KpiController(new PgPoolClient(createDatabaseConfig(loadEnv())));

  router.get(
    "/runs/latest",
    asyncRoute((request, response) => controller.latest(request, response)),
  );

  router.get(
    "/runs",
    asyncRoute((request, response) => controller.latest(request, response)),
  );

  return router;
}
