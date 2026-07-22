import type { Request, Response } from "express";
import { z } from "zod";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { transitionObligationSchema } from "./obligations.schemas.js";
import type { ObligationService } from "./obligations.service.js";
import type { ObligationRepository } from "./obligations.repository.js";

export class ObligationController {
  constructor(private readonly service?: ObligationService, private readonly repository?: ObligationRepository) {}

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

  async transition(request: Request, response: Response): Promise<void> {
    if (!this.service || !this.repository) {
      response.status(500).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Obligation service not configured", details: {}, correlationId: String(response.locals.correlationId ?? "unknown") } });
      return;
    }

    const parseResult = transitionObligationSchema.safeParse(request.body);
    if (!parseResult.success) {
      response.status(400).json({ success: false, error: { code: "INVALID_REQUEST", message: "Invalid transition payload", details: parseResult.error.format(), correlationId: String(response.locals.correlationId ?? "unknown") } });
      return;
    }

    const obligationId = String(request.params.obligationId ?? "");
    const actorId = String(request.headers["x-user-id"] ?? "system");

    const obligation = await this.repository.findById(obligationId);
    if (!obligation) {
      response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Obligation not found", details: {}, correlationId: String(response.locals.correlationId ?? "unknown") } });
      return;
    }

    try {
      const updated = await this.service.transition({
        obligationId,
        fromStatus: obligation.status,
        toStatus: parseResult.data.toStatus,
        expectedVersion: parseResult.data.expectedVersion,
        actorId,
      });

      response.status(200).json({ success: true, data: updated });
    } catch (error: unknown) {
      // Bubble up error middleware to translate into API response
      throw error;
    }
  }
}
