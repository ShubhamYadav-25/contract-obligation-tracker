import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { createMessageDependencies } from "./messages.dependencies.js";
import { MessageController } from "./messages.controller.js";

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
