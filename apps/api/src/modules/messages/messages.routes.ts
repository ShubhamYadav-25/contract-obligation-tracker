/**
 * @file Defines backend messages module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { createMessageDependencies } from "./messages.dependencies.js";
import { MessageController } from "./messages.controller.js";

/**
 * @description Executes the create message router operation used by the application workflow.
 * @returns {Router} Result of the create message router operation.
 */
export function createMessageRouter(): Router {
  const router = Router();
  const deps = createMessageDependencies();
  const controller = new MessageController(deps.messages);

  router.get(
    "/",
    requireAuthContext,
    asyncRoute((request, response) => controller.list(request, response)),
  );

  return router;
}
