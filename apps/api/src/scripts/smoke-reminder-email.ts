/**
 * @file Creates synthetic reminder data and verifies real Brevo delivery plus message visibility.
 */
import { randomUUID } from "node:crypto";

import { createDatabaseConfig } from "../config/database.js";
import { createEmailConfig } from "../config/email.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { BrevoEmailAdapter } from "../infrastructure/email/brevo.adapter.js";
import { ReminderDeliveryProcessor } from "../jobs/processors/reminder-delivery.processor.js";
import type { BackgroundJob } from "../jobs/job.types.js";
import { PostgresMessageRepository } from "../modules/messages/postgres-message.repository.js";

interface SmokeResultRow {
  readonly reminder_status: string;
  readonly retry_count: number | string;
  readonly attempt_provider: string;
  readonly attempt_status: string;
  readonly provider_message_id: string | null;
  readonly inbox_count: number | string;
  readonly inbox_payload: unknown;
}

/**
 * @description Redacts recipient addresses from the smoke-test message payload before logging.
 * @param {unknown} payload - Raw inbox payload stored after reminder delivery.
 * @returns {unknown} Sanitized payload safe for console output.
 */
function sanitizeMessagePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  return {
    ...(payload as Record<string, unknown>),
    recipient: "[configured-recipient]",
  };
}

/**
 * @description Creates a background job fixture for a synthetic reminder delivery.
 * @param {{ readonly reminderId: string; readonly occurrenceKey: string }} payload - Reminder identifiers to deliver.
 * @returns {BackgroundJob} Synthetic reminder delivery job.
 */
function createSyntheticJob(payload: {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}): BackgroundJob {
  const now = new Date();
  return {
    id: randomUUID(),
    jobType: "DELIVER_REMINDER",
    idempotencyKey: `smoke:${payload.reminderId}:delivery`,
    payload,
    status: "PENDING",
    priority: 0,
    availableAt: now,
    attemptCount: 0,
    maxAttempts: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @description Inserts synthetic contract, obligation, and reminder rows for email delivery testing.
 * @param {PgPoolClient} database - PostgreSQL client used for synthetic setup.
 * @param {{ readonly organizationId: string; readonly userId: string }} actor - Synthetic row ownership identifiers.
 * @returns {Promise<{ readonly contractId: string; readonly obligationId: string; readonly reminderId: string; readonly occurrenceKey: string; readonly dueAt: Date; }>} Created synthetic row identifiers.
 */
async function createSyntheticReminder(
  database: PgPoolClient,
  actor: { readonly organizationId: string; readonly userId: string },
): Promise<{
  readonly contractId: string;
  readonly obligationId: string;
  readonly reminderId: string;
  readonly occurrenceKey: string;
  readonly dueAt: Date;
}> {
  const suffix = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000);
  const occurrenceKey = `synthetic-brevo-smoke:${suffix}`;

  const contract = await database.query<{ readonly id: string }>(
    `
      INSERT INTO contracts (organization_id, uploaded_by, display_name, external_ref)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [
      actor.organizationId,
      actor.userId,
      `Synthetic Brevo Reminder Smoke ${suffix}`,
      occurrenceKey,
    ],
  );
  const contractId = contract.rows[0]?.id;
  if (!contractId) {
    throw new Error("Synthetic contract creation returned no id");
  }

  const obligation = await database.query<{ readonly id: string }>(
    `
      INSERT INTO obligations (contract_id, title, description, due_at, anchors)
      VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb)
      RETURNING id
    `,
    [
      contractId,
      "Synthetic quarterly compliance reminder",
      "Review the synthetic contract obligation and confirm the reminder email workflow is functioning.",
      dueAt,
      JSON.stringify([
        {
          obligatedParty: "Synthetic Operations Team",
          obligationType: "COMPLIANCE",
          timing: {
            timingType: "DUE_DATE",
            frequency: "ONE_TIME",
            offsetValue: 3,
            offsetUnit: "DAYS",
            offsetDirection: "BEFORE",
          },
          confidence: {
            overall: 1,
            reviewStatus: "SMOKE_TEST",
          },
        },
      ]),
    ],
  );
  const obligationId = obligation.rows[0]?.id;
  if (!obligationId) {
    throw new Error("Synthetic obligation creation returned no id");
  }

  const reminder = await database.query<{ readonly id: string }>(
    `
      INSERT INTO reminders (obligation_id, scheduled_for, occurrence_key, status)
      VALUES ($1, NOW(), $2, 'PENDING')
      RETURNING id
    `,
    [obligationId, occurrenceKey],
  );
  const reminderId = reminder.rows[0]?.id;
  if (!reminderId) {
    throw new Error("Synthetic reminder creation returned no id");
  }

  return { contractId, obligationId, reminderId, occurrenceKey, dueAt };
}

/**
 * @description Loads the synthetic reminder delivery result from reminder, attempt, and inbox tables.
 * @param {PgPoolClient} database - PostgreSQL client used for verification.
 * @param {string} reminderId - Reminder identifier to verify.
 * @returns {Promise<SmokeResultRow>} Aggregated delivery result row.
 */
async function loadSmokeResult(database: PgPoolClient, reminderId: string): Promise<SmokeResultRow> {
  const result = await database.query<SmokeResultRow>(
    `
      SELECT
        reminder.status::text AS reminder_status,
        reminder.retry_count,
        attempt.provider AS attempt_provider,
        attempt.status::text AS attempt_status,
        attempt.provider_message_id,
        COUNT(inbox.id)::int AS inbox_count,
        MAX(inbox.payload::text)::jsonb AS inbox_payload
      FROM reminders AS reminder
      INNER JOIN reminder_delivery_attempts AS attempt
        ON attempt.reminder_id = reminder.id
      LEFT JOIN inbox_entries AS inbox
        ON inbox.reminder_id = reminder.id
      WHERE reminder.id = $1
      GROUP BY
        reminder.status,
        reminder.retry_count,
        attempt.provider,
        attempt.status,
        attempt.provider_message_id
    `,
    [reminderId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Synthetic reminder verification returned no row");
  }
  return row;
}

/**
 * @description Runs the synthetic reminder email smoke test against the configured database and Brevo account.
 * @returns {Promise<void>} Resolves after synthetic delivery is sent and verified.
 * @throws {Error} When configuration, delivery, or persistence verification fails.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const emailConfig = createEmailConfig(env);
  if (!emailConfig.brevo.apiKey || !emailConfig.from || !emailConfig.defaultRecipient) {
    throw new Error(
      "BREVO_API_KEY, EMAIL_FROM_ADDRESS, and a reminder recipient are required for the smoke test",
    );
  }

  const database = new PgPoolClient(createDatabaseConfig(env));
  try {
    const synthetic = await createSyntheticReminder(database, {
      organizationId: env.INGESTION_DEFAULT_ORGANIZATION_ID,
      userId: env.INGESTION_DEFAULT_USER_ID,
    });
    const provider = new BrevoEmailAdapter({
      apiKey: emailConfig.brevo.apiKey,
      senderEmail: emailConfig.from,
      senderName: emailConfig.fromName ?? env.APP_NAME,
    });
    const transactions = new PgTransactionManager(database.pool);
    const processor = new ReminderDeliveryProcessor(
      database,
      transactions,
      provider,
      {
        providerName: "BREVO",
        appName: env.APP_NAME,
        appBaseUrl: env.APP_BASE_URL,
        from: emailConfig.from,
        defaultRecipient: emailConfig.defaultRecipient,
      },
    );

    await processor.process(
      createSyntheticJob({
        reminderId: synthetic.reminderId,
        occurrenceKey: synthetic.occurrenceKey,
      }),
    );

    const verification = await loadSmokeResult(database, synthetic.reminderId);
    const messageRows = await new PostgresMessageRepository(transactions).listByOrganization({
      organizationId: env.INGESTION_DEFAULT_ORGANIZATION_ID,
      reminderId: synthetic.reminderId,
      limit: 5,
      offset: 0,
    });
    console.log(
      JSON.stringify(
        {
          success:
            verification.reminder_status === "DELIVERED" &&
            verification.attempt_status === "DELIVERED" &&
            Number(verification.inbox_count) === 1 &&
            messageRows.length === 1,
          synthetic,
          delivery: {
            reminderStatus: verification.reminder_status,
            retryCount: Number(verification.retry_count),
            attemptProvider: verification.attempt_provider,
            attemptStatus: verification.attempt_status,
            providerMessageId: verification.provider_message_id,
            inboxEntries: Number(verification.inbox_count),
            recipientSource: env.REMINDER_RECIPIENT_EMAIL
              ? "REMINDER_RECIPIENT_EMAIL"
              : "EMAIL_FROM_ADDRESS",
          },
          messagesPage: {
            visibleRows: messageRows.length,
            reminderStatus: messageRows[0]?.reminderStatus ?? null,
            obligationTitle: messageRows[0]?.obligationTitle ?? null,
          },
          messagePayload: sanitizeMessagePayload(verification.inbox_payload),
        },
        null,
        2,
      ),
    );
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
