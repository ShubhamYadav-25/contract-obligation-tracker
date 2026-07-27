/**
 * @file Defines backend dashboard router composition and endpoint mapping.
 */
import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { DashboardController } from "./dashboard.controller.js";
import { createDashboardDependencies } from "./dashboard.dependencies.js";

/**
 * @description Executes the create dashboard router operation used by the application workflow.
 * @returns {Router} Result of the create dashboard router operation.
 */
export function createDashboardRouter(): Router {
  const router = Router();
  const controller = new DashboardController(createDashboardDependencies().operations);

  router.get(
    "/overview",
    requireAuthContext,
    asyncRoute((request, response) => controller.overview(request, response)),
  );

  router.get(
    "/review-queue",
    requireAuthContext,
    asyncRoute((request, response) => controller.reviewQueue(request, response)),
  );

  return router;
}
