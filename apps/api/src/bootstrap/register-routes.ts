import type express from "express";

import { createContractRouter } from "../modules/contracts/contracts.routes.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import { createKpiRouter } from "../modules/kpi/kpi.routes.js";
import { createObligationRouter } from "../modules/obligations/obligations.routes.js";
import { createReminderRouter } from "../modules/reminders/reminders.routes.js";

export function registerRoutes(app: express.Express): void {
  app.use("/health", createHealthRouter());
  app.use("/api/v1/contracts", createContractRouter());
  app.use("/api/obligations", createObligationRouter());
  app.use("/api/reminders", createReminderRouter());
  app.use("/api/kpi", createKpiRouter());
}
