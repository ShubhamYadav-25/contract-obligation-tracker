/**
 * @file Processes reminder delivery jobs by sending emails and publishing delivered messages.
 */
import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { NotificationProvider } from "../../modules/notifications/notifications.types.js";
import {
  buildReminderEmail,
  type ReminderEmailTemplate,
} from "../../modules/reminders/reminder-email-template.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";

export interface ReminderDeliveryPayload {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}

export interface ReminderDeliveryProcessorConfig {
  readonly providerName: string;
  readonly appName: string;
  readonly appBaseUrl: string;
  readonly from?: string;
  readonly defaultRecipient?: string;
  readonly now?: () => Date;
}

interface ReminderDeliveryRow {
  readonly id: string;
  readonly obligation_id: string;
  readonly status: string;
  readonly retry_count: number | string;
  readonly scheduled_for: Date | string;
  readonly occurrence_key: string;
  readonly contract_id: string;
  readonly contract_display_name: string;
  readonly obligation_title: string;
  readonly obligation_description: string | null;
  readonly due_at: Date | string | null;
  readonly anchors: unknown;
}

/**
 * @description Parses and validates the background job payload for reminder delivery.
 * @param {unknown} payload - Raw background job payload.
 * @returns {ReminderDeliveryPayload} Validated reminder delivery payload.
 * @throws {PermanentJobError} When required reminder identifiers are missing.
 */
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

/**
 * @description Converts a database timestamp value into a Date instance.
 * @param {Date | string} value - Database timestamp value.
 * @returns {Date} Parsed date object.
 */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * @description Converts a nullable database timestamp into a Date instance when present.
 * @param {Date | string | null} value - Nullable database timestamp value.
 * @returns {Date | null} Parsed date object or null.
 */
function toNullableDate(value: Date | string | null): Date | null {
  return value ? toDate(value) : null;
}

/**
 * @description Reads the first JSON anchor object attached to an obligation.
 * @param {unknown} anchors - Raw anchors value from the obligations table.
 * @returns {Record<string, unknown> | null} First anchor object or null.
 */
function primaryAnchor(anchors: unknown): Record<string, unknown> | null {
  const anchor = Array.isArray(anchors) ? anchors[0] : null;
  return anchor && typeof anchor === "object" && !Array.isArray(anchor)
    ? (anchor as Record<string, unknown>)
    : null;
}

/**
 * @description Returns a trimmed string value from one of several possible object keys.
 * @param {Record<string, unknown> | null} record - Source object to inspect.
 * @param {readonly string[]} keys - Candidate keys in priority order.
 * @returns {string | undefined} First non-empty string value.
 */
function stringFromKeys(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

/**
 * @description Creates the frontend contract URL included in reminder emails.
 * @param {string} appBaseUrl - Public application base URL.
 * @param {string} contractId - Contract identifier.
 * @returns {string} Absolute contract page URL.
 */
function createContractUrl(appBaseUrl: string, contractId: string): string {
  return `${appBaseUrl.replace(/\/$/, "")}/contracts/${contractId}`;
}

/**
 * @description Builds the persisted message payload shown after email acceptance.
 * @param {ReminderDeliveryPayload} payload - Reminder delivery job payload.
 * @param {ReminderDeliveryRow} reminder - Locked reminder and obligation row.
 * @param {ReminderEmailTemplate} email - Generated reminder email content and timing metadata.
 * @param {{ readonly providerName: string; readonly recipient: string; readonly providerMessageId?: string; readonly sentAt: Date; }} delivery - Accepted provider delivery metadata.
 * @returns {Record<string, unknown>} JSON payload stored with the inbox message.
 */
function createInboxPayload(
  payload: ReminderDeliveryPayload,
  reminder: ReminderDeliveryRow,
  email: ReminderEmailTemplate,
  delivery: {
    readonly providerName: string;
    readonly recipient: string;
    readonly providerMessageId?: string;
    readonly sentAt: Date;
  },
): Record<string, unknown> {
  return {
    ...payload,
    channel: "email",
    provider: delivery.providerName,
    providerMessageId: delivery.providerMessageId ?? null,
    recipient: delivery.recipient,
    subject: email.subject,
    timingLabel: email.timingLabel,
    daysRemaining: email.daysRemaining ?? null,
    contractId: reminder.contract_id,
    contractDisplayName: reminder.contract_display_name,
    obligationTitle: reminder.obligation_title,
    sentAt: delivery.sentAt.toISOString(),
  };
}

export class ReminderDeliveryProcessor {
  /**
   * @description Creates the reminder delivery processor with database, transaction, and mail dependencies.
   * @param {PostgreSqlClient} database - Shared PostgreSQL client retained with processor lifecycle dependencies.
   * @param {TransactionManager} transactions - Transaction boundary used for reminder locking and status updates.
   * @param {NotificationProvider} notifications - Mail provider used to deliver reminder notifications.
   * @param {ReminderDeliveryProcessorConfig} config - Provider labels, sender defaults, and runtime URL settings.
   * @returns {unknown} Constructed reminder delivery processor instance.
   */
  constructor(
    private readonly database: PostgreSqlClient,
    private readonly transactions: TransactionManager,
    private readonly notifications: NotificationProvider,
    private readonly config: ReminderDeliveryProcessorConfig,
  ) {}

  /**
   * @description Sends a reminder email and publishes the message record only after accepted delivery.
   * @param {BackgroundJob} job - Background job containing reminder delivery identifiers.
   * @returns {Promise<void>} Resolves after delivery status, attempt status, and message visibility are updated.
   * @throws {Error} When the job payload is invalid or email delivery fails.
   */
  async process(job: BackgroundJob): Promise<void> {
    const payload = parsePayload(job.payload);

    await this.transactions.inTransaction(async ({ client }) => {
      const remRes = await client.query<ReminderDeliveryRow>(
        `
        SELECT
          reminder.id,
          reminder.obligation_id,
          reminder.status,
          reminder.retry_count,
          reminder.scheduled_for,
          reminder.occurrence_key,
          obligation.contract_id,
          contract.display_name AS contract_display_name,
          obligation.title AS obligation_title,
          obligation.description AS obligation_description,
          obligation.due_at,
          obligation.anchors
        FROM reminders AS reminder
        INNER JOIN obligations AS obligation
          ON obligation.id = reminder.obligation_id
        INNER JOIN contracts AS contract
          ON contract.id = obligation.contract_id
        WHERE reminder.id = $1
        FOR UPDATE OF reminder
        `,
        [payload.reminderId],
      );

      const reminder = remRes.rows[0];
      if (!reminder) {
        return;
      }
      if (reminder.status === "DELIVERED") {
        return;
      }

      const attemptNumber = Number(reminder.retry_count) + 1;
      await client.query(
        `INSERT INTO reminder_delivery_attempts (reminder_id, attempt_number, provider, status, started_at)
         VALUES ($1, $2, $3, 'STARTED', NOW())`,
        [payload.reminderId, attemptNumber, this.config.providerName],
      );

      try {
        const recipient = this.config.defaultRecipient;
        if (!recipient) {
          throw new ExternalServiceError("Reminder email recipient is not configured", {
            reminderId: payload.reminderId,
          });
        }

        const anchor = primaryAnchor(reminder.anchors);
        const now = this.config.now?.() ?? new Date();
        const responsibleParty = stringFromKeys(anchor, ["obligatedParty", "obligated_party"]);
        const category = stringFromKeys(anchor, ["obligationType", "obligation_type"]);
        const email = buildReminderEmail({
          appName: this.config.appName,
          contractName: reminder.contract_display_name,
          obligationTitle: reminder.obligation_title,
          obligationDescription: reminder.obligation_description,
          ...(responsibleParty ? { responsibleParty } : {}),
          ...(category ? { category } : {}),
          dueAt: toNullableDate(reminder.due_at),
          scheduledFor: toDate(reminder.scheduled_for),
          now,
          contractUrl: createContractUrl(this.config.appBaseUrl, reminder.contract_id),
        });

        const delivery = await this.notifications.send({
          recipient,
          ...(this.config.from ? { from: this.config.from } : {}),
          subject: email.subject,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          correlationId: job.id,
        });

        if (delivery.status !== "accepted") {
          throw new ExternalServiceError("Reminder email delivery was rejected", {
            reminderId: payload.reminderId,
            recipient,
          });
        }

        await client.query(
          `INSERT INTO inbox_entries (reminder_id, obligation_id, payload, created_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (reminder_id) DO NOTHING`,
          [
            payload.reminderId,
            reminder.obligation_id,
            createInboxPayload(payload, reminder, email, {
              providerName: this.config.providerName,
              recipient,
              ...(delivery.providerMessageId
                ? { providerMessageId: delivery.providerMessageId }
                : {}),
              sentAt: now,
            }),
          ],
        );

        await client.query(
          `UPDATE reminder_delivery_attempts
           SET status = 'DELIVERED', provider_message_id = $3, completed_at = NOW()
           WHERE reminder_id = $1 AND attempt_number = $2`,
          [payload.reminderId, attemptNumber, delivery.providerMessageId ?? null],
        );

        await client.query(
          `UPDATE reminders SET status = 'DELIVERED', retry_count = $2, version = version + 1, updated_at = NOW() WHERE id = $1`,
          [payload.reminderId, attemptNumber],
        );
      } catch (error) {
        await client.query(
          `UPDATE reminder_delivery_attempts SET status = 'FAILED', error_message = $3, completed_at = NOW() WHERE reminder_id = $1 AND attempt_number = $2`,
          [
            payload.reminderId,
            attemptNumber,
            error instanceof Error ? error.message : String(error),
          ],
        );

        await client.query(
          `UPDATE reminders SET status = 'RETRY_PENDING', retry_count = $2, updated_at = NOW() WHERE id = $1`,
          [payload.reminderId, attemptNumber],
        );

        throw error;
      }
    });
  }
}
