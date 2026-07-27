import { Router } from "express";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { OperationsController } from "./operations.controller.js";
import { createOperationsDependencies } from "./operations.dependencies.js";

export function createOperationsRouter(): Router {
  const router = Router();
  const controller = new OperationsController(createOperationsDependencies().operations);
  router.get("/:contractId/processing-history", requireAuthContext, asyncRoute((req, res) => controller.processingHistory(req, res)));
  router.get("/:contractId/activity", requireAuthContext, asyncRoute((req, res) => controller.activity(req, res)));
  return router;
}
