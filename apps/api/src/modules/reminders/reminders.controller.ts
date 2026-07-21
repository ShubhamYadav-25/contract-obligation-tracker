import type { Request, Response } from "express";

export class ReminderController {
  async list(_request: Request, response: Response): Promise<void> {
    response.status(501).json({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Reminder retrieval requires repository implementation",
        details: {},
        correlationId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
