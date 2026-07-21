import { readFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PgPoolClient } from "../../src/infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import { PostgresContractProcessingRepository } from "../../src/modules/contracts/postgres-contract.repository.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

const organizationId = "00000000-0000-4000-8000-000000000001";
const uploadedBy = "00000000-0000-4000-8000-000000000002";
const contractId = "00000000-0000-4000-8000-000000000003";
const documentId = "00000000-0000-4000-8000-000000000004";
const processingRunId = "00000000-0000-4000-8000-000000000005";

async function applyMigration(pool: pg.Pool, filename: string) {
  const migration = await readFile(
    path.resolve(process.cwd(), "../../packages/database/migrations", filename),
    "utf8",
  );
  await pool.query(migration);
}

describeWithDatabase("PostgresContractProcessingRepository integration", () => {
  let pool: pg.Pool;
  let database: PgPoolClient;
  let transactions: PgTransactionManager;
  let processingRuns: PostgresContractProcessingRepository;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
    }

    pool = new pg.Pool({ connectionString: testDatabaseUrl, ssl: false });
    await applyMigration(pool, "202607200001_supabase_postgres_jobs.up.sql");
    await applyMigration(pool, "202607210001_contract_ingestion.up.sql");
    await applyMigration(pool, "202607210002_contract_processing_lifecycle.up.sql");
    await applyMigration(pool, "202607210003_contract_document_upload_lifecycle.up.sql");

    database = new PgPoolClient({
      connectionString: testDatabaseUrl,
      ssl: false,
      poolMax: 5,
      connectionTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 30_000,
    });
    transactions = new PgTransactionManager(database.pool);
    processingRuns = new PostgresContractProcessingRepository(database);
  });

  afterAll(async () => {
    await database?.close();
    await pool?.end();
  });

  async function seedQueuedRun() {
    await pool.query(
      "TRUNCATE contract_processing_runs, contract_documents, contracts, audit_events RESTART IDENTITY CASCADE",
    );
    await pool.query(
      `
        INSERT INTO contracts (id, organization_id, uploaded_by, display_name, status)
        VALUES ($1, $2, $3, 'Atomic Claim Contract', 'DRAFT')
      `,
      [contractId, organizationId, uploadedBy],
    );
    await pool.query(
      `
        INSERT INTO contract_documents (
          id,
          organization_id,
          contract_id,
          version_number,
          original_filename,
          storage_provider,
          storage_bucket,
          storage_key,
          mime_type,
          file_size_bytes,
          file_hash_sha256,
          source_type,
          uploaded_by
        )
        VALUES (
          $1,
          $2,
          $3,
          1,
          'contract.pdf',
          'supabase',
          'contracts',
          'contracts/test/contract.pdf',
          'application/pdf',
          128,
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'USER_UPLOAD',
          $4
        )
      `,
      [documentId, organizationId, contractId, uploadedBy],
    );
    await pool.query("UPDATE contracts SET current_document_id = $1 WHERE id = $2", [
      documentId,
      contractId,
    ]);
    await pool.query(
      `
        INSERT INTO contract_processing_runs (
          id,
          contract_id,
          document_id,
          status,
          attempt_number,
          queue_job_id
        )
        VALUES ($1, $2, $3, 'QUEUED', 1, 'contract:process:1')
      `,
      [processingRunId, contractId, documentId],
    );
  }

  it("claims a queued processing run atomically", async () => {
    await seedQueuedRun();

    const claimed = await transactions.inTransaction((transaction) =>
      processingRuns.claimForProcessing(
        {
          organizationId,
          contractId,
          documentId,
          processingRunId,
          queueJobId: "contract:process:1",
          attemptNumber: 1,
        },
        transaction,
      ),
    );

    expect(claimed?.status).toBe("PROCESSING");
    expect(claimed?.attemptNumber).toBe(1);
  });

  it("does not allow two concurrent claims to both succeed", async () => {
    await seedQueuedRun();

    const [firstClaim, secondClaim] = await Promise.all([
      transactions.inTransaction((transaction) =>
        processingRuns.claimForProcessing(
          {
            organizationId,
            contractId,
            documentId,
            processingRunId,
            queueJobId: "contract:process:1",
            attemptNumber: 1,
          },
          transaction,
        ),
      ),
      transactions.inTransaction((transaction) =>
        processingRuns.claimForProcessing(
          {
            organizationId,
            contractId,
            documentId,
            processingRunId,
            queueJobId: "contract:process:1",
            attemptNumber: 1,
          },
          transaction,
        ),
      ),
    ]);

    expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1);
  });

  it("allows a later retry attempt to reclaim a previously processing run", async () => {
    await seedQueuedRun();
    await pool.query(
      "UPDATE contract_processing_runs SET status = 'PROCESSING', attempt_number = 1 WHERE id = $1",
      [processingRunId],
    );

    const claimed = await transactions.inTransaction((transaction) =>
      processingRuns.claimForProcessing(
        {
          organizationId,
          contractId,
          documentId,
          processingRunId,
          queueJobId: "contract:process:1",
          attemptNumber: 2,
        },
        transaction,
      ),
    );

    expect(claimed?.status).toBe("PROCESSING");
    expect(claimed?.attemptNumber).toBe(2);
  });
});
