import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { ObligationController } from "./obligations.controller.js";

export function createObligationRouter(): Router {
  const router = Router();
  const controller = new ObligationController();

  router.get(
    "/",
    asyncRoute((request, response) => controller.list(request, response)),
  );

  return router;
}
