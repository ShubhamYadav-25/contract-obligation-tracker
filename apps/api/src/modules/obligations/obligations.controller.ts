import type { Request, Response } from "express";
import { z } from "zod";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { transitionObligationSchema } from "./obligations.schemas.js";
import type { ObligationService } from "./obligations.service.js";
import type { ObligationRepository } from "./obligations.repository.js";
import type { ObligationDetailRecord, ObligationRecord } from "./obligations.types.js";

const listQuerySchema = z.object({
  contractId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function serializeObligation(record: ObligationRecord) {
  return {
    id: record.id,
    contractId: record.contractId,
    contractDisplayName: record.contractDisplayName ?? null,
    title: record.title,
    description: record.description,
    status: record.status,
    dueAt: record.dueAt?.toISOString(),
    reminderStatus: record.reminderStatus ?? null,
    nextReminderAt: record.nextReminderAt?.toISOString() ?? null,
    sourceAnchors: record.sourceAnchors,
    version: record.version,
  };
}

function serializeObligationDetail(record: ObligationDetailRecord) {
  return {
    ...serializeObligation(record),
    sourceText: record.sourceText,
    transitionHistory: record.transitionHistory.map((item) => ({
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      actor: item.actorId,
      occurredAt: item.occurredAt.toISOString(),
    })),
  };
}

export class ObligationController {
  constructor(
    private readonly service?: ObligationService,
    private readonly repository?: ObligationRepository,
  ) {}

  async list(request: Request, response: Response): Promise<void> {
    if (!this.repository) {
      throw new ApplicationError({
        code: "NOT_CONFIGURED",
        message: "Obligation repository is not configured",
        statusCode: 500,
      });
    }
    if (!request.authContext) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

    const query = listQuerySchema.parse(request.query);
    const obligations = await this.repository.listByOrganization({
      organizationId: request.authContext.organizationId,
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.search ? { search: query.search } : {}),
      limit: query.limit,
      offset: query.offset,
    });

    response.json({
      success: true,
      data: obligations.map(serializeObligation),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        limit: query.limit,
        offset: query.offset,
      },
    });
  }

  async transition(request: Request, response: Response): Promise<void> {
    if (!this.service || !this.repository) {
      throw new ApplicationError({
        code: "NOT_CONFIGURED",
        message: "Obligation service is not configured",
        statusCode: 500,
      });
    }

    const parseResult = transitionObligationSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ApplicationError({
        code: "INVALID_REQUEST",
        message: "Invalid transition payload",
        statusCode: 400,
        details: parseResult.error.format(),
      });
    }

    const obligationId = String(request.params.obligationId ?? "");
    const actorId = String(request.headers["x-user-id"] ?? "system");

    const obligation = await this.repository.findById(obligationId);
    if (!obligation) {
      throw new ApplicationError({
        code: "NOT_FOUND",
        message: "Obligation not found",
        statusCode: 404,
        details: { obligationId },
      });
    }

    try {
      const updated = await this.service.transition({
        obligationId,
        fromStatus: obligation.status,
        toStatus: parseResult.data.toStatus,
        expectedVersion: parseResult.data.expectedVersion,
        actorId,
      });

      response.status(200).json({ success: true, data: serializeObligation(updated) });
    } catch (error: unknown) {
      // Bubble up error middleware to translate into API response
      throw error;
    }
  }

  async detail(request: Request, response: Response): Promise<void> {
    if (!this.repository) {
      throw new ApplicationError({
        code: "NOT_CONFIGURED",
        message: "Obligation repository is not configured",
        statusCode: 500,
      });
    }
    if (!request.authContext) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

    const obligationId = String(request.params.obligationId ?? "");
    const obligation = await this.repository.findDetailByOrganizationAndId({
      organizationId: request.authContext.organizationId,
      obligationId,
    });
    if (!obligation) {
      throw new ApplicationError({
        code: "NOT_FOUND",
        message: "Obligation not found",
        statusCode: 404,
        details: { obligationId },
      });
    }

    response.json({
      success: true,
      data: serializeObligationDetail(obligation),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
