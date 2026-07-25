/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { createReminderDeliveryJobKey } from "../../jobs/job-keys.js";
import type { ReminderSchedulerRepository } from "./reminders.repository.js";

interface ReminderRow {
  readonly id: string;
  readonly occurrence_key: string;
}

export class PostgresReminderSchedulerRepository implements ReminderSchedulerRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {TransactionManager} transactions - Input value for transactions.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * @description Implements the enqueue due reminders method for this service or adapter.
   * @param {{ readonly now: Date; readonly lookaheadUntil: Date; readonly limit: number; }} input - Input value for input.
   * @returns {Promise<{ readonly remindersClaimed: number; readonly jobsCreated: number }>} Result of the enqueue due reminders operation.
   */
  async enqueueDueReminders(input: {
    readonly now: Date;
    readonly lookaheadUntil: Date;
    readonly limit: number;
  }): Promise<{ readonly remindersClaimed: number; readonly jobsCreated: number }> {
    return this.transactions.inTransaction(async ({ client }) => {
      const reminders = await client.query<ReminderRow>(
        `
          WITH due_reminders AS (
            SELECT id, occurrence_key
            FROM reminders
            WHERE status IN ('PENDING', 'RETRY_PENDING')
              AND scheduled_for <= $1
            ORDER BY scheduled_for, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT $2
          )
          UPDATE reminders AS reminder
          SET status = 'ENQUEUED',
              updated_at = NOW()
          FROM due_reminders
          WHERE reminder.id = due_reminders.id
          RETURNING reminder.id, reminder.occurrence_key
        `,
        [input.lookaheadUntil, input.limit],
      );

      let jobsCreated = 0;
      for (const reminder of reminders.rows) {
        const insert = await client.query(
          `
            INSERT INTO background_jobs (job_type, idempotency_key, payload)
            VALUES (
              'DELIVER_REMINDER',
              $1,
              jsonb_build_object('reminderId', $2::text, 'occurrenceKey', $3::text)
            )
            ON CONFLICT (idempotency_key) DO NOTHING
          `,
          [createReminderDeliveryJobKey(reminder.id), reminder.id, reminder.occurrence_key],
        );
        jobsCreated += insert.rowCount ?? 0;
      }

      return {
        remindersClaimed: reminders.rowCount ?? 0,
        jobsCreated,
      };
    });
  }
}
