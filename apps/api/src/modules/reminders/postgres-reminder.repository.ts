/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { ReminderReadRepository } from "./reminders.repository.js";
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

export class PostgresReminderRepository implements ReminderReadRepository {
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
}
