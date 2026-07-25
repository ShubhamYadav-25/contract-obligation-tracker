/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import { Router } from "express";
import { requireAuthContext } from "../auth/request-context.js";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { ExtractionController } from "./extraction.controller.js";

/**
 * @description Executes the create extraction router operation used by the application workflow.
 * @returns {Router} Result of the create extraction router operation.
 */
export function createExtractionRouter(): Router {
  const router = Router();
  const controller = new ExtractionController();

  // Per-contract candidates (test-only)
  router.get(
    "/contracts/:contractId/candidates",
    requireAuthContext,
    asyncRoute((req, res) => controller.listByContract(req, res)),
  );
  router.post(
    "/candidates/:candidateId/approve",
    requireAuthContext,
    asyncRoute((req, res) => controller.approveCandidate(req, res)),
  );

  // Review-compatible endpoints expected by the web UI
  router.get(
    "/reviews",
    requireAuthContext,
    asyncRoute((req, res) => controller.listAll(req, res)),
  );
  router.get(
    "/reviews/:candidateId",
    requireAuthContext,
    asyncRoute((req, res) => controller.detail(req, res)),
  );
  router.post(
    "/reviews/:candidateId/approve",
    requireAuthContext,
    asyncRoute((req, res) => controller.approveCandidate(req, res)),
  );
  router.post(
    "/reviews/:candidateId/reject",
    requireAuthContext,
    asyncRoute((req, res) => controller.rejectCandidate(req, res)),
  );

  return router;
}
