import type { Request, Response } from "express";
import { z } from "zod";
import { ApplicationError } from "../../shared/errors/application-error.js";
import {
  obligationStatusSchema,
  transitionObligationSchema,
  updateObligationSchema,
} from "./obligations.schemas.js";
import type { ObligationService } from "./obligations.service.js";
import type {
  ObligationDueDateRangeFilter,
  ObligationReminderFilter,
  ObligationRepository,
} from "./obligations.repository.js";
import type {
  ObligationDetailRecord,
  ObligationEditableFields,
  ObligationRecord,
} from "./obligations.types.js";

type MutableEditableFields = {
  -readonly [Key in keyof ObligationEditableFields]?: ObligationEditableFields[Key];
};

const listQuerySchema = z.object({
  contractId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  status: obligationStatusSchema.optional(),
  reminderStatus: z
    .enum([
      "PENDING",
      "ENQUEUED",
      "PROCESSING",
      "DELIVERED",
      "RETRY_PENDING",
      "FAILED",
      "CANCELLED",
      "NONE",
    ])
    .optional(),
  dueDateRange: z.enum(["OVERDUE", "NEXT_7_DAYS", "NEXT_30_DAYS"]).optional(),
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
    responsibleParty: record.responsibleParty ?? null,
    counterparty: record.counterparty ?? null,
    category: record.category ?? null,
    timingType: record.timingType ?? null,
    frequency: record.frequency ?? null,
    triggerEvent: record.triggerEvent ?? null,
    offsetValue: record.offsetValue ?? null,
    offsetUnit: record.offsetUnit ?? null,
    offsetDirection: record.offsetDirection ?? null,
    confidence: record.confidence ?? null,
    reviewStatus: record.reviewStatus ?? null,
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
    const result = await this.repository.listByOrganization({
      organizationId: request.authContext.organizationId,
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.reminderStatus
        ? { reminderStatus: query.reminderStatus as ObligationReminderFilter }
        : {}),
      ...(query.dueDateRange
        ? { dueDateRange: query.dueDateRange as ObligationDueDateRangeFilter }
        : {}),
      limit: query.limit,
      offset: query.offset,
    });

    response.json({
      success: true,
      data: {
        items: result.items.map(serializeObligation),
        total: result.total,
        statusCounts: result.statusCounts,
      },
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        limit: query.limit,
        offset: query.offset,
        status: query.status ?? null,
        reminderStatus: query.reminderStatus ?? null,
        dueDateRange: query.dueDateRange ?? null,
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

  async update(request: Request, response: Response): Promise<void> {
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

    const parseResult = updateObligationSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ApplicationError({
        code: "INVALID_REQUEST",
        message: "Invalid obligation update payload",
        statusCode: 400,
        details: parseResult.error.format(),
      });
    }

    const payload = parseResult.data;
    const fields: MutableEditableFields = {};
    if (Object.prototype.hasOwnProperty.call(payload, "title") && payload.title !== undefined) {
      fields.title = payload.title;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "description") &&
      payload.description !== undefined
    ) {
      fields.description = payload.description;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "dueAt") && payload.dueAt !== undefined) {
      fields.dueAt = payload.dueAt === null ? null : new Date(payload.dueAt);
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "responsibleParty") &&
      payload.responsibleParty !== undefined
    ) {
      fields.responsibleParty = payload.responsibleParty;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "counterparty") &&
      payload.counterparty !== undefined
    ) {
      fields.counterparty = payload.counterparty;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "category") &&
      payload.category !== undefined
    ) {
      fields.category = payload.category;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "timingType") &&
      payload.timingType !== undefined
    ) {
      fields.timingType = payload.timingType;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "frequency") &&
      payload.frequency !== undefined
    ) {
      fields.frequency = payload.frequency;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "triggerEvent") &&
      payload.triggerEvent !== undefined
    ) {
      fields.triggerEvent = payload.triggerEvent;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "offsetValue") &&
      payload.offsetValue !== undefined
    ) {
      fields.offsetValue = payload.offsetValue;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "offsetUnit") &&
      payload.offsetUnit !== undefined
    ) {
      fields.offsetUnit = payload.offsetUnit;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "offsetDirection") &&
      payload.offsetDirection !== undefined
    ) {
      fields.offsetDirection = payload.offsetDirection;
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "reviewStatus") &&
      payload.reviewStatus !== undefined
    ) {
      fields.reviewStatus = payload.reviewStatus;
    }

    const obligationId = String(request.params.obligationId ?? "");
    const updated = await this.repository.updateEditableFields({
      organizationId: request.authContext.organizationId,
      obligationId,
      expectedVersion: payload.expectedVersion,
      fields,
    });

    response.status(200).json({ success: true, data: serializeObligation(updated) });
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
