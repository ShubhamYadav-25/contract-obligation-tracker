/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type {
  TransactionContext,
  TransactionManager,
} from "../../infrastructure/database/transaction-manager.js";
import { createReminderOccurrenceKey } from "./reminder-occurrence-key.js";
import type {
  ExtractedObligationReminderRepository,
  ReminderReadRepository,
} from "./reminders.repository.js";
import type { ObligationRecord } from "../obligations/obligations.types.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ReminderRecord, ReminderStatus } from "./reminders.types.js";

interface ReminderRow {
  readonly id: string;
  readonly obligation_id: string;
  readonly contract_id: string | null;
  readonly obligation_title: string | null;
  readonly scheduled_for: Date | string;
  readonly occurrence_key: string;
  readonly status: ReminderStatus;
  readonly retry_count: number | string;
  readonly lease_expires_at: Date | string | null;
  readonly version: number | string;
}

/**
 * @description Performs the to date helper operation for this module.
 * @param {Date | string} value - Input value for value.
 * @returns {Date} Result of the to date operation.
 */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * @description Performs the map reminder helper operation for this module.
 * @param {ReminderRow} row - Input value for row.
 * @returns {ReminderRecord} Result of the map reminder operation.
 */
function mapReminder(row: ReminderRow): ReminderRecord {
  return {
    id: row.id,
    obligationId: row.obligation_id,
    ...(row.contract_id ? { contractId: row.contract_id } : {}),
    ...(row.obligation_title ? { obligationTitle: row.obligation_title } : {}),
    scheduledFor: toDate(row.scheduled_for),
    occurrenceKey: row.occurrence_key,
    status: row.status,
    retryCount: Number(row.retry_count),
    ...(row.lease_expires_at ? { leaseExpiresAt: toDate(row.lease_expires_at) } : {}),
    version: Number(row.version),
  };
}

export class PostgresReminderRepository
  implements ReminderReadRepository, ExtractedObligationReminderRepository
{
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {TransactionManager} transactions - Input value for transactions.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * @description Executes the list by organization operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly obligationId?: string; readonly limit: number; readonly offset: number; }} input - Input value for input.
   * @returns {Promise<readonly ReminderRecord[]>} Result of the list by organization operation.
   */
  async listByOrganization(input: {
    readonly organizationId: string;
    readonly obligationId?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly ReminderRecord[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<ReminderRow>(
        `
          SELECT
            reminder.id,
            reminder.obligation_id,
            obligation.contract_id,
            obligation.title AS obligation_title,
            reminder.scheduled_for,
            reminder.occurrence_key,
            reminder.status,
            reminder.retry_count,
            reminder.lease_expires_at,
            reminder.version
          FROM reminders AS reminder
          INNER JOIN obligations AS obligation
            ON obligation.id = reminder.obligation_id
          INNER JOIN contracts AS contract
            ON contract.id = obligation.contract_id
          WHERE contract.organization_id = $1
            AND ($2::uuid IS NULL OR reminder.obligation_id = $2::uuid)
          ORDER BY reminder.scheduled_for ASC, reminder.created_at ASC
          LIMIT $3 OFFSET $4
        `,
        [input.organizationId, input.obligationId ?? null, input.limit, input.offset],
      );

      return result.rows.map(mapReminder);
    });
  }

  async createForOrganization(input: {
    readonly organizationId: string;
    readonly obligationId: string;
    readonly scheduledFor: Date;
    readonly occurrenceKey: string;
  }): Promise<ReminderRecord> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<ReminderRow>(
        `
          INSERT INTO reminders (obligation_id, scheduled_for, occurrence_key, status)
          SELECT obligation.id, $3, $4, 'PENDING'
          FROM obligations AS obligation
          INNER JOIN contracts AS contract ON contract.id = obligation.contract_id
          WHERE obligation.id = $2 AND contract.organization_id = $1
          RETURNING id, obligation_id, NULL::uuid AS contract_id,
                    NULL::text AS obligation_title, scheduled_for, occurrence_key,
                    status, retry_count, lease_expires_at, version
        `,
        [input.organizationId, input.obligationId, input.scheduledFor, input.occurrenceKey],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApplicationError({
          code: "REMINDER_OBLIGATION_NOT_FOUND",
          message: "Obligation was not found for this organization",
          statusCode: 404,
        });
      }
      return mapReminder(row);
    });
  }

  async rescheduleForOrganization(input: {
    readonly organizationId: string;
    readonly reminderId: string;
    readonly scheduledFor: Date;
    readonly occurrenceKey: string;
    readonly expectedVersion: number;
  }): Promise<ReminderRecord> {
    return this.updateControlled(input, "RESCHEDULE");
  }

  async transitionForOrganization(input: {
    readonly organizationId: string;
    readonly reminderId: string;
    readonly action: "CANCEL" | "ACTIVATE" | "RETRY";
    readonly expectedVersion: number;
  }): Promise<ReminderRecord> {
    return this.updateControlled(input, input.action);
  }

  private async updateControlled(
    input: {
      readonly organizationId: string;
      readonly reminderId: string;
      readonly expectedVersion: number;
      readonly scheduledFor?: Date;
      readonly occurrenceKey?: string;
    },
    action: "RESCHEDULE" | "CANCEL" | "ACTIVATE" | "RETRY",
  ): Promise<ReminderRecord> {
    return this.transactions.inTransaction(async ({ client }) => {
      const allowedStatuses =
        action === "CANCEL"
          ? ["PENDING", "ENQUEUED", "RETRY_PENDING", "FAILED"]
          : action === "RETRY"
            ? ["FAILED"]
            : action === "ACTIVATE"
              ? ["CANCELLED"]
              : ["PENDING", "RETRY_PENDING", "FAILED", "CANCELLED"];
      const nextStatus = action === "CANCEL" ? "CANCELLED" : "PENDING";
      const result = await client.query<ReminderRow>(
        `
          UPDATE reminders AS reminder
          SET scheduled_for = COALESCE($4::timestamptz, reminder.scheduled_for),
              occurrence_key = COALESCE($5, reminder.occurrence_key),
              status = $6::reminder_status,
              retry_count = CASE WHEN $6 = 'PENDING' THEN 0 ELSE reminder.retry_count END,
              lease_expires_at = NULL,
              version = reminder.version + 1,
              updated_at = NOW()
          FROM obligations AS obligation, contracts AS contract
          WHERE reminder.id = $2
            AND reminder.obligation_id = obligation.id
            AND obligation.contract_id = contract.id
            AND contract.organization_id = $1
            AND reminder.version = $3
            AND reminder.status = ANY($7::reminder_status[])
          RETURNING reminder.id, reminder.obligation_id, NULL::uuid AS contract_id,
                    NULL::text AS obligation_title, reminder.scheduled_for,
                    reminder.occurrence_key, reminder.status, reminder.retry_count,
                    reminder.lease_expires_at, reminder.version
        `,
        [
          input.organizationId,
          input.reminderId,
          input.expectedVersion,
          input.scheduledFor ?? null,
          input.occurrenceKey ?? null,
          nextStatus,
          allowedStatuses,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ApplicationError({
          code: "REMINDER_STATE_CONFLICT",
          message: "Reminder changed or the requested action is not allowed from its current state",
          statusCode: 409,
          details: { action, expectedVersion: input.expectedVersion },
        });
      }
      return mapReminder(row);
    });
  }

  async createForObligations(
    input: {
      readonly obligations: readonly ObligationRecord[];
      readonly offsetBeforeDueMinutes: number;
    },
    transaction: TransactionContext,
  ): Promise<number> {
    let created = 0;
    for (const obligation of input.obligations) {
      if (!obligation.dueAt) {
        continue;
      }
      const scheduledFor = new Date(
        obligation.dueAt.getTime() - input.offsetBeforeDueMinutes * 60_000,
      );
      const result = await transaction.client.query(
        `
          INSERT INTO reminders (obligation_id, scheduled_for, occurrence_key, status)
          VALUES ($1, $2, $3, 'PENDING')
          ON CONFLICT (occurrence_key) DO NOTHING
        `,
        [
          obligation.id,
          scheduledFor,
          createReminderOccurrenceKey({ obligationId: obligation.id, scheduledFor }),
        ],
      );
      created += result.rowCount ?? 0;
    }
    return created;
  }
}
