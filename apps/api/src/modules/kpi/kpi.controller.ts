import type { Request, Response } from "express";

export class KpiController {
  async listRuns(_request: Request, response: Response): Promise<void> {
    response.status(501).json({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "KPI retrieval requires repository implementation",
        details: {},
        correlationId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
