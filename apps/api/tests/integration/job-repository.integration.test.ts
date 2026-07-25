/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgPoolClient } from "../../src/infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import { PostgresJobRepository } from "../../src/jobs/job.repository.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("PostgresJobRepository integration", () => {
  let pool: pg.Pool;
  let database: PgPoolClient;
  let jobs: PostgresJobRepository;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
    }

    pool = new pg.Pool({ connectionString: testDatabaseUrl, ssl: false });
    const migration = await readFile(
      path.resolve(
        process.cwd(),
        "../../packages/database/migrations/202607200001_supabase_postgres_jobs.up.sql",
      ),
      "utf8",
    );
    await pool.query(migration);
    await pool.query(
      "TRUNCATE background_jobs, reminders, reminder_delivery_attempts, audit_events",
    );

    database = new PgPoolClient({
      connectionString: testDatabaseUrl,
      ssl: false,
      poolMax: 3,
      connectionTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 30_000,
    });
    jobs = new PostgresJobRepository(database, new PgTransactionManager(database.pool));
  });

  afterAll(async () => {
    await database?.close();
    await pool?.end();
  });

  it("deduplicates jobs by idempotency key", async () => {
    const first = await jobs.createJob({
      jobType: "PROCESS_CONTRACT",
      idempotencyKey: "contract:test:process:1",
      payload: { contractId: "test", documentVersion: 1 },
    });
    const second = await jobs.createJob({
      jobType: "PROCESS_CONTRACT",
      idempotencyKey: "contract:test:process:1",
      payload: { contractId: "test", documentVersion: 1 },
    });

    expect(second.id).toBe(first.id);
  });

  it("claims jobs with row locks so each logical job is claimed once", async () => {
    await jobs.createJob({
      jobType: "PROCESS_CONTRACT",
      idempotencyKey: "contract:claim:process:1",
      payload: { contractId: "claim", documentVersion: 1 },
    });

    const [firstClaim, secondClaim] = await Promise.all([
      jobs.claimJobs({ limit: 1, workerId: "worker-a", lockDurationMilliseconds: 30_000 }),
      jobs.claimJobs({ limit: 1, workerId: "worker-b", lockDurationMilliseconds: 30_000 }),
    ]);

    expect(firstClaim.length + secondClaim.length).toBe(1);
  });

  it("recovers expired processing locks", async () => {
    const job = await jobs.createJob({
      jobType: "DELIVER_REMINDER",
      idempotencyKey: "reminder:expired:delivery",
      payload: { reminderId: "expired", occurrenceKey: "occurrence" },
    });
    const claimed = await jobs.claimJobs({
      limit: 1,
      workerId: "worker-a",
      lockDurationMilliseconds: 1,
    });
    expect(claimed.some((candidate) => candidate.id === job.id)).toBe(true);

    await pool.query(
      "UPDATE background_jobs SET lock_expires_at = NOW() - interval '1 second' WHERE id = $1",
      [job.id],
    );

    const recovered = await jobs.recoverExpiredJobs(new Date());
    expect(recovered.some((candidate) => candidate.id === job.id)).toBe(true);
  });
});
