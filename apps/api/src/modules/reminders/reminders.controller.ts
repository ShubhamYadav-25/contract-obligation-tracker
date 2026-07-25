/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
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

/**
 * @description Performs the serialize reminder helper operation for this module.
 * @param {ReminderRecord} record - Input value for record.
 * @returns {unknown} Result of the serialize reminder operation.
 */
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
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReminderReadRepository} reminders - Input value for reminders.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly reminders: ReminderReadRepository) {}

  /**
   * @description Executes the list operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the list operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
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
