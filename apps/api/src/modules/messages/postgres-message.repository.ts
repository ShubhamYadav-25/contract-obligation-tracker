import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { MessageReadRepository } from "./messages.repository.js";
import type { MessageRecord } from "./messages.types.js";

interface MessageRow {
  readonly id: string;
  readonly reminder_id: string;
  readonly obligation_id: string;
  readonly contract_id: string;
  readonly contract_display_name: string;
  readonly obligation_title: string;
  readonly reminder_status: string;
  readonly scheduled_for: Date | string;
  readonly payload: unknown;
  readonly created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    obligationId: row.obligation_id,
    contractId: row.contract_id,
    contractDisplayName: row.contract_display_name,
    obligationTitle: row.obligation_title,
    reminderStatus: row.reminder_status,
    scheduledFor: toDate(row.scheduled_for),
    payload: row.payload,
    createdAt: toDate(row.created_at),
  };
}

export class PostgresMessageRepository implements MessageReadRepository {
  constructor(private readonly transactions: TransactionManager) {}

  async listByOrganization(input: {
    readonly organizationId: string;
    readonly obligationId?: string;
    readonly reminderId?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly MessageRecord[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<MessageRow>(
        `
          SELECT
            inbox.id,
            inbox.reminder_id,
            inbox.obligation_id,
            obligation.contract_id,
            contract.display_name AS contract_display_name,
            obligation.title AS obligation_title,
            reminder.status::text AS reminder_status,
            reminder.scheduled_for,
            inbox.payload,
            inbox.created_at
          FROM inbox_entries AS inbox
          INNER JOIN reminders AS reminder
            ON reminder.id = inbox.reminder_id
          INNER JOIN obligations AS obligation
            ON obligation.id = inbox.obligation_id
          INNER JOIN contracts AS contract
            ON contract.id = obligation.contract_id
          WHERE contract.organization_id = $1
            AND ($2::uuid IS NULL OR inbox.obligation_id = $2::uuid)
            AND ($3::uuid IS NULL OR inbox.reminder_id = $3::uuid)
          ORDER BY inbox.created_at DESC, inbox.id DESC
          LIMIT $4 OFFSET $5
        `,
        [
          input.organizationId,
          input.obligationId ?? null,
          input.reminderId ?? null,
          input.limit,
          input.offset,
        ],
      );

      return result.rows.map(mapMessage);
    });
  }
}
