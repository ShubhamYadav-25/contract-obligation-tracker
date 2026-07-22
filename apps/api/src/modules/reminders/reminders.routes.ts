import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { createReminderDependencies } from "./reminders.dependencies.js";
import { ReminderController } from "./reminders.controller.js";

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
