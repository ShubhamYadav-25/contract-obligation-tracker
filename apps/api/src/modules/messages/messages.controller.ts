import type { Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { MessageReadRepository } from "./messages.repository.js";
import type { MessageRecord } from "./messages.types.js";

const listQuerySchema = z.object({
  obligationId: z.uuid().optional(),
  reminderId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function serializeMessage(record: MessageRecord) {
  return {
    id: record.id,
    reminderId: record.reminderId,
    obligationId: record.obligationId,
    contractId: record.contractId,
    contractDisplayName: record.contractDisplayName,
    obligationTitle: record.obligationTitle,
    reminderStatus: record.reminderStatus,
    scheduledFor: record.scheduledFor.toISOString(),
    payload: record.payload,
    createdAt: record.createdAt.toISOString(),
  };
}

export class MessageController {
  constructor(private readonly messages: MessageReadRepository) {}

  async list(request: Request, response: Response): Promise<void> {
    if (!request.authContext) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }

    const query = listQuerySchema.parse(request.query);
    const messages = await this.messages.listByOrganization({
      organizationId: request.authContext.organizationId,
      ...(query.obligationId ? { obligationId: query.obligationId } : {}),
      ...(query.reminderId ? { reminderId: query.reminderId } : {}),
      limit: query.limit,
      offset: query.offset,
    });

    response.json({
      success: true,
      data: messages.map(serializeMessage),
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        limit: query.limit,
        offset: query.offset,
      },
    });
  }
}
