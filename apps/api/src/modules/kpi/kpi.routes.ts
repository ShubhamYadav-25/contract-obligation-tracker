/**
 * @file Defines backend kpi module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";

import { getApplicationDatabase } from "../../infrastructure/database/app-database.js";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { KpiController } from "./kpi.controller.js";

/**
 * @description Executes the create kpi router operation used by the application workflow.
 * @returns {Router} Result of the create kpi router operation.
 */
export function createKpiRouter(): Router {
  const router = Router();
  const controller = new KpiController(getApplicationDatabase());

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
