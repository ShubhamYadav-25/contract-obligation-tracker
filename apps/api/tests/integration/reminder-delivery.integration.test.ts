import { readFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgPoolClient } from "../../src/infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import { ReminderDeliveryProcessor } from "../../src/jobs/processors/reminder-delivery.processor.js";
import type { BackgroundJob } from "../../src/jobs/job.types.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

function createJob(payload: { reminderId: string; occurrenceKey: string }): BackgroundJob {
  return {
    id: "job-1",
    jobType: "DELIVER_REMINDER",
    idempotencyKey: `reminder:${payload.reminderId}`,
    payload,
    status: "PENDING",
    priority: 0,
    availableAt: new Date(),
    attemptCount: 0,
    maxAttempts: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describeWithDatabase("ReminderDeliveryProcessor integration", () => {
  let pool: pg.Pool;
  let database: PgPoolClient;
  let processor: ReminderDeliveryProcessor;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
    }

    pool = new pg.Pool({ connectionString: testDatabaseUrl, ssl: false });
    const jobsMigration = await readFile(
      path.resolve(
        process.cwd(),
        "../../packages/database/migrations/202607200001_supabase_postgres_jobs.up.sql",
      ),
      "utf8",
    );
    const inboxMigration = await readFile(
      path.resolve(
        process.cwd(),
        "../../packages/database/migrations/202607220004_inbox_entries.up.sql",
      ),
      "utf8",
    );

    await pool.query(jobsMigration);
    await pool.query(inboxMigration);
    await pool.query(
      "TRUNCATE background_jobs, reminders, reminder_delivery_attempts, inbox_entries, audit_events",
    );

    database = new PgPoolClient({
      connectionString: testDatabaseUrl,
      ssl: false,
      poolMax: 3,
      connectionTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 30_000,
    });
    processor = new ReminderDeliveryProcessor(database, new PgTransactionManager(database.pool));
  });

  afterAll(async () => {
    await database?.close();
    await pool?.end();
  });

  it("creates a sandbox inbox entry and only delivers once for repeated runs", async () => {
    const reminderId = "11111111-1111-1111-1111-111111111111";
    const obligationId = "22222222-2222-2222-2222-222222222222";
    const occurrenceKey = "occurrence:alpha";

    await pool.query(
      `INSERT INTO reminders (id, obligation_id, scheduled_for, occurrence_key, status, version)
       VALUES ($1, $2, NOW(), $3, 'PENDING', 0)`,
      [reminderId, obligationId, occurrenceKey],
    );

    const firstJob = createJob({ reminderId, occurrenceKey });
    await processor.process(firstJob);

    const firstReminder = await pool.query(
      "SELECT status, retry_count, version FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(firstReminder.rows[0].status).toBe("DELIVERED");
    expect(firstReminder.rows[0].retry_count).toBe(1);
    expect(firstReminder.rows[0].version).toBe(1);

    const firstAttempts = await pool.query(
      "SELECT status, attempt_number FROM reminder_delivery_attempts WHERE reminder_id = $1 ORDER BY attempt_number",
      [reminderId],
    );
    expect(firstAttempts.rows).toHaveLength(1);
    expect(firstAttempts.rows[0].status).toBe("DELIVERED");

    const inboxEntries = await pool.query(
      "SELECT reminder_id, obligation_id, payload FROM inbox_entries WHERE reminder_id = $1",
      [reminderId],
    );
    expect(inboxEntries.rows).toHaveLength(1);
    expect(inboxEntries.rows[0].obligation_id).toBe(obligationId);
    expect(inboxEntries.rows[0].payload).toMatchObject({ reminderId, occurrenceKey });

    await processor.process(createJob({ reminderId, occurrenceKey }));

    const secondReminder = await pool.query(
      "SELECT status, retry_count, version FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(secondReminder.rows[0].status).toBe("DELIVERED");
    expect(secondReminder.rows[0].retry_count).toBe(1);
    expect(secondReminder.rows[0].version).toBe(1);

    const secondAttempts = await pool.query(
      "SELECT COUNT(*)::int AS count FROM reminder_delivery_attempts WHERE reminder_id = $1",
      [reminderId],
    );
    expect(secondAttempts.rows[0].count).toBe(1);

    const secondInboxEntries = await pool.query(
      "SELECT COUNT(*)::int AS count FROM inbox_entries WHERE reminder_id = $1",
      [reminderId],
    );
    expect(secondInboxEntries.rows[0].count).toBe(1);
  });
});
