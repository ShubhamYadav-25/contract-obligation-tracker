import type { Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ReminderReadRepository } from "./reminders.repository.js";
import type { ReminderRecord } from "./reminders.types.js";

const listQuerySchema = z.object({
  obligationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function serializeReminder(record: ReminderRecord) {
  return {
    id: record.id,
    obligationId: record.obligationId,
    contractId: record.contractId ?? null,
    obligationTitle: record.obligationTitle ?? null,
    scheduledFor: record.scheduledFor.toISOString(),
    occurrenceKey: record.occurrenceKey,
    status: record.status,
    retryCount: record.retryCount,
    leaseExpiresAt: record.leaseExpiresAt?.toISOString() ?? null,
    version: record.version,
  };
}

export class ReminderController {
  constructor(private readonly reminders: ReminderReadRepository) {}

  async list(request: Request, response: Response): Promise<void> {
    if (!request.authContext) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

    const query = listQuerySchema.parse(request.query);
    const reminders = await this.reminders.listByOrganization({
      organizationId: request.authContext.organizationId,
      ...(query.obligationId ? { obligationId: query.obligationId } : {}),
      limit: query.limit,
      offset: query.offset,
    });

    response.json({
      success: true,
      data: reminders.map(serializeReminder),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        limit: query.limit,
        offset: query.offset,
      },
    });
  }
}
