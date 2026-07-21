import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { KpiController } from "./kpi.controller.js";

export function createKpiRouter(): Router {
  const router = Router();
  const controller = new KpiController();

  router.get(
    "/runs",
    asyncRoute((request, response) => controller.listRuns(request, response)),
  );

  return router;
}
