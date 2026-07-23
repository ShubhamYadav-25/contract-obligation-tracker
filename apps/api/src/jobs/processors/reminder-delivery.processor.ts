import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";

export interface ReminderDeliveryPayload {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}

function parsePayload(payload: unknown): ReminderDeliveryPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "reminderId" in payload &&
    "occurrenceKey" in payload &&
    typeof (payload as any).reminderId === "string" &&
    typeof (payload as any).occurrenceKey === "string"
  ) {
    return {
      reminderId: (payload as any).reminderId,
      occurrenceKey: (payload as any).occurrenceKey,
    };
  }

  throw new PermanentJobError("Invalid reminder delivery job payload");
}

export class ReminderDeliveryProcessor {
  constructor(
    private readonly database: PostgreSqlClient,
    private readonly transactions: TransactionManager,
  ) {}

  async process(job: BackgroundJob): Promise<void> {
    const payload = parsePayload(job.payload);

    await this.transactions.inTransaction(async ({ client }) => {
      // Lock the reminder row to avoid concurrent delivery
      const remRes = await client.query(
        `SELECT id, obligation_id, status, retry_count, version FROM reminders WHERE id = $1 FOR UPDATE`,
        [payload.reminderId],
      );

      if (remRes.rowCount === 0) {
        // Nothing to do — reminder disappeared
        return;
      }

      const rem = remRes.rows[0];
      if (rem.status === "DELIVERED") {
        // idempotent: already delivered
        return;
      }

      const attemptNumber = rem.retry_count + 1;

      // record attempt started
      await client.query(
        `INSERT INTO reminder_delivery_attempts (reminder_id, attempt_number, provider, status, started_at)
         VALUES ($1, $2, $3, 'STARTED', NOW())`,
        [payload.reminderId, attemptNumber, "INBOX"],
      );

      try {
        // perform delivery: sandboxed inbox_entries table
        // insert an inbox entry so reviewers can inspect it instead of sending real emails
        await client.query(
          `INSERT INTO inbox_entries (reminder_id, obligation_id, payload, created_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (reminder_id) DO NOTHING`,
          [payload.reminderId, rem.obligation_id, job.payload ?? {}],
        );

        // mark attempt delivered
        await client.query(
          `UPDATE reminder_delivery_attempts SET status = 'DELIVERED', completed_at = NOW() WHERE reminder_id = $1 AND attempt_number = $2`,
          [payload.reminderId, attemptNumber],
        );

        // mark reminder delivered
        await client.query(
          `UPDATE reminders SET status = 'DELIVERED', retry_count = $2, version = version + 1, updated_at = NOW() WHERE id = $1`,
          [payload.reminderId, attemptNumber],
        );
      } catch (error) {
        // mark attempt failed
        await client.query(
          `UPDATE reminder_delivery_attempts SET status = 'FAILED', error_message = $3, completed_at = NOW() WHERE reminder_id = $1 AND attempt_number = $2`,
          [
            payload.reminderId,
            attemptNumber,
            error instanceof Error ? error.message : String(error),
          ],
        );

        // set reminder to retry pending and increment retry_count
        await client.query(
          `UPDATE reminders SET status = 'RETRY_PENDING', retry_count = $2, updated_at = NOW() WHERE id = $1`,
          [payload.reminderId, attemptNumber],
        );

        // bubble error to job runner so retry policies apply
        throw error;
      }
    });
  }
}
