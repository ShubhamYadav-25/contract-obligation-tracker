/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { createReminderDependencies } from "./reminders.dependencies.js";
import { ReminderController } from "./reminders.controller.js";

/**
 * @description Executes the create reminder router operation used by the application workflow.
 * @returns {Router} Result of the create reminder router operation.
 */
export function createReminderRouter(): Router {
  const router = Router();
  const deps = createReminderDependencies();
  const controller = new ReminderController(deps.reminders);

  router.get(
    "/",
    requireAuthContext,
    asyncRoute((request, response) => controller.list(request, response)),
  );

  return router;
}
