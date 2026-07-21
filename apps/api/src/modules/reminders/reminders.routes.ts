import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { ReminderController } from "./reminders.controller.js";

export function createReminderRouter(): Router {
  const router = Router();
  const controller = new ReminderController();

  router.get(
    "/",
    asyncRoute((request, response) => controller.list(request, response)),
  );

  return router;
}
