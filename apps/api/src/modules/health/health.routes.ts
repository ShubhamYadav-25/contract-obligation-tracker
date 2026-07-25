/**
 * @file Defines backend health module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";

/**
 * @description Executes the create health router operation used by the application workflow.
 * @returns {Router} Result of the create health router operation.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      success: true,
      data: {
        status: "ok",
        service: "contract-obligation-tracker-api",
      },
    });
  });

  return router;
}
