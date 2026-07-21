import type { Request, Response } from "express";

export class ObligationController {
  async list(_request: Request, response: Response): Promise<void> {
    response.status(501).json({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Obligation listing requires repository implementation",
        details: {},
        correlationId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
