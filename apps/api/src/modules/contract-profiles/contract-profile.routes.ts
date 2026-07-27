import { Router } from "express";

import { asyncRoute } from "../../shared/middleware/async-route.js";
import { requireAuthContext } from "../auth/request-context.js";
import { ContractProfileController } from "./contract-profile.controller.js";
import { createContractProfileDependencies } from "./contract-profile.dependencies.js";

export function createContractProfileRouter(): Router {
  const router = Router();
  const controller = new ContractProfileController(
    createContractProfileDependencies().profiles,
  );

  router.get(
    "/:contractId/profile",
    requireAuthContext,
    asyncRoute((request, response) => controller.get(request, response)),
  );
  router.post(
    "/:contractId/profile",
    requireAuthContext,
    asyncRoute((request, response) => controller.create(request, response)),
  );
  router.patch(
    "/:contractId/profile",
    requireAuthContext,
    asyncRoute((request, response) => controller.update(request, response)),
  );
  router.delete(
    "/:contractId/profile",
    requireAuthContext,
    asyncRoute((request, response) => controller.delete(request, response)),
  );

  return router;
}
