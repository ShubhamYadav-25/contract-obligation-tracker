/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type { Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ReminderReadRepository } from "./reminders.repository.js";
import type { ReminderRecord } from "./reminders.types.js";
import { createReminderOccurrenceKey } from "./reminder-occurrence-key.js";

const listQuerySchema = z.object({
  obligationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const createReminderSchema = z.object({
  obligationId: z.uuid(),
  scheduledFor: z.iso.datetime({ offset: true }),
});
const rescheduleReminderSchema = z.object({
  scheduledFor: z.iso.datetime({ offset: true }),
  expectedVersion: z.number().int().min(0),
});
const reminderActionSchema = z.object({
  action: z.enum(["CANCEL", "ACTIVATE", "RETRY"]),
  expectedVersion: z.number().int().min(0),
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

  async create(request: Request, response: Response): Promise<void> {
    const auth = request.authContext;
    if (!auth) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }
    const input = createReminderSchema.parse(request.body);
    const scheduledFor = new Date(input.scheduledFor);
    const reminder = await this.reminders.createForOrganization({
      organizationId: auth.organizationId,
      obligationId: input.obligationId,
      scheduledFor,
      occurrenceKey: createReminderOccurrenceKey({
        obligationId: input.obligationId,
        scheduledFor,
      }),
    });
    response.status(201).json({ success: true, data: serializeReminder(reminder) });
  }

  async reschedule(request: Request, response: Response): Promise<void> {
    const auth = request.authContext;
    if (!auth) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }
    const reminderId = String(request.params.reminderId ?? "");
    const input = rescheduleReminderSchema.parse(request.body);
    const scheduledFor = new Date(input.scheduledFor);
    const reminder = await this.reminders.rescheduleForOrganization({
      organizationId: auth.organizationId,
      reminderId,
      scheduledFor,
      expectedVersion: input.expectedVersion,
      occurrenceKey: `reminder:${reminderId}:scheduled:${scheduledFor.toISOString()}`,
    });
    response.json({ success: true, data: serializeReminder(reminder) });
  }

  async action(request: Request, response: Response): Promise<void> {
    const auth = request.authContext;
    if (!auth) {
      throw new ApplicationError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authenticated user and organization context is required",
        statusCode: 401,
      });
    }
    const input = reminderActionSchema.parse(request.body);
    const reminder = await this.reminders.transitionForOrganization({
      organizationId: auth.organizationId,
      reminderId: String(request.params.reminderId ?? ""),
      action: input.action,
      expectedVersion: input.expectedVersion,
    });
    response.json({ success: true, data: serializeReminder(reminder) });
  }
}
