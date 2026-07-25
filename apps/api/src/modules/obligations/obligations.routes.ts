/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { ObligationController } from "./obligations.controller.js";
import { createObligationServiceDependencies } from "./obligations.dependencies.js";
import { requireAuthContext } from "../auth/request-context.js";

/**
 * @description Executes the create obligation router operation used by the application workflow.
 * @returns {Router} Result of the create obligation router operation.
 */
export function createObligationRouter(): Router {
  const router = Router();
  const deps = createObligationServiceDependencies();
  const controller = new ObligationController(deps.service, deps.obligations);

  router.get(
    "/",
    requireAuthContext,
    asyncRoute((request, response) => controller.list(request, response)),
  );

  router.get(
    "/:obligationId",
    requireAuthContext,
    asyncRoute((request, response) => controller.detail(request, response)),
  );

  router.patch(
    "/:obligationId",
    requireAuthContext,
    asyncRoute((request, response) => controller.update(request, response)),
  );

  router.patch(
    "/:obligationId/status",
    requireAuthContext,
    asyncRoute((request, response) => controller.transition(request, response)),
  );

  router.post(
    "/:obligationId/transition",
    requireAuthContext,
    asyncRoute((request, response) => controller.transition(request, response)),
  );

  return router;
}
