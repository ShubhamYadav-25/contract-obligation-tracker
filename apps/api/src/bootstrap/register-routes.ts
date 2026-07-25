/**
 * @file Defines API bootstrap wiring for routes, workers, schedulers, or shutdown handling.
 */
import type express from "express";

import { createContractRouter } from "../modules/contracts/contracts.routes.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import { createKpiRouter } from "../modules/kpi/kpi.routes.js";
import { createMessageRouter } from "../modules/messages/messages.routes.js";
import { createObligationRouter } from "../modules/obligations/obligations.routes.js";
import { createReminderRouter } from "../modules/reminders/reminders.routes.js";
import { createExtractionRouter } from "../modules/extraction/extraction.routes.js";

/**
 * @description Performs the register routes helper operation for this module.
 * @param {express.Express} app - Input value for app.
 * @returns {void} Result of the register routes operation.
 */
export function registerRoutes(app: express.Express): void {
  app.use("/health", createHealthRouter());
  app.use("/api/v1/contracts", createContractRouter());
  app.use("/api/obligations", createObligationRouter());
  app.use("/api/reminders", createReminderRouter());
  app.use("/api/messages", createMessageRouter());
  app.use("/api/kpi", createKpiRouter());
  app.use("/api", createExtractionRouter());
}
