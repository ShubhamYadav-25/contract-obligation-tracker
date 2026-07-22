import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createJobConfig } from "../config/jobs.js";
import { createLogger } from "../config/logger.js";
import { createWorkerRuntime } from "../bootstrap/register-workers.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { PostgresJobRepository } from "../jobs/job.repository.js";
import { PostgresContractProcessingRepository } from "../modules/contracts/postgres-contract.repository.js";

interface ProcessingRunRow {
  readonly organization_id: string;
  readonly contract_id: string;
  readonly document_id: string;
  readonly processing_run_id: string;
  readonly display_name: string;
  readonly status: string;
}

interface CountRow {
  readonly contracts: number;
  readonly stored_documents: number;
  readonly processing_runs: number;
  readonly obligations: number;
  readonly obligations_with_boxes: number;
}

function readLimit(): number {
  const value = process.env.CONTRACT_OBLIGATION_REPROCESS_LIMIT;
  if (!value) return 25;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("CONTRACT_OBLIGATION_REPROCESS_LIMIT must be a positive integer");
  }
  return parsed;
}

function queueKey(row: ProcessingRunRow, batchId: string, index: number): string {
  return `contract-processing:${row.document_id}:obligation-reprocess:${batchId}:${index + 1}`;
}

async function countRows(database: PgPoolClient): Promise<CountRow> {
  const result = await database.query<CountRow>(
    `
      SELECT
        (SELECT COUNT(*)::int FROM contracts) AS contracts,
        (SELECT COUNT(*)::int FROM contract_documents WHERE upload_status = 'STORED') AS stored_documents,
        (SELECT COUNT(*)::int FROM contract_processing_runs) AS processing_runs,
        (SELECT COUNT(*)::int FROM obligations) AS obligations,
        (SELECT COUNT(*)::int FROM obligations WHERE anchors::text LIKE '%"boxes"%') AS obligations_with_boxes
    `,
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Count query returned no row");
  }
  return row;
}

async function listLatestStoredRuns(
  database: PgPoolClient,
  limit: number,
): Promise<readonly ProcessingRunRow[]> {
  const result = await database.query<ProcessingRunRow>(
    `
      SELECT
        contract.organization_id,
        run.contract_id,
        run.document_id,
        run.id AS processing_run_id,
        contract.display_name,
        run.status
      FROM contract_processing_runs AS run
      INNER JOIN contracts AS contract
        ON contract.id = run.contract_id
      INNER JOIN contract_documents AS document
        ON document.id = run.document_id
        AND document.contract_id = run.contract_id
      WHERE document.upload_status = 'STORED'
        AND NOT EXISTS (
          SELECT 1
          FROM contract_processing_runs AS newer_run
          WHERE newer_run.contract_id = run.contract_id
            AND newer_run.created_at > run.created_at
        )
      ORDER BY run.created_at ASC
      LIMIT $1
    `,
    [limit],
  );
  return result.rows;
}

async function main(): Promise<void> {
  process.env.JOB_BATCH_SIZE = "1";
  const env = loadEnv();
  const logger = createLogger(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobs = new PostgresJobRepository(database, transactions);
  const processingRuns = new PostgresContractProcessingRepository(database);
  const limit = readLimit();
  const batchId = Date.now().toString(36);
  const jobConfig = createJobConfig(env);

  console.log("obligation_reprocess_config", {
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
    hasGroqApiKey: Boolean(env.GROQ_API_KEY),
    groqExtractionModel: env.GROQ_EXTRACTION_MODEL,
    jobBatchSize: jobConfig.batchSize,
    limit,
  });

  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required for Groq obligation extraction");
  }

  let enqueued = 0;
  try {
    const before = await countRows(database);
    const runs = await listLatestStoredRuns(database, limit);
    console.log("obligation_reprocess_before", { ...before, runCount: runs.length });

    await database.query("TRUNCATE TABLE obligations CASCADE");
    console.log("obligation_table_truncated", { table: "obligations", cascade: true });

    for (const [index, row] of runs.entries()) {
      const idempotencyKey = queueKey(row, batchId, index);
      await jobs.createJob({
        jobType: "PROCESS_CONTRACT",
        idempotencyKey,
        payload: {
          organizationId: row.organization_id,
          contractId: row.contract_id,
          documentId: row.document_id,
          processingRunId: row.processing_run_id,
        },
        priority: 100,
        maxAttempts: 1,
      });
      await processingRuns.markQueued({
        processingRunId: row.processing_run_id,
        queueJobId: idempotencyKey,
      });
      enqueued += 1;
      console.log("obligation_reprocess_enqueued", {
        contractId: row.contract_id,
        documentId: row.document_id,
        processingRunId: row.processing_run_id,
        displayName: row.display_name,
        previousStatus: row.status,
      });
    }
  } finally {
    await database.close();
  }

  const runtime = createWorkerRuntime({ logger });
  let claimed = 0;
  try {
    await jobs.recoverExpiredJobs(new Date());
    for (let index = 0; index < enqueued; index += 1) {
      const count = await runtime.runOnce();
      claimed += count;
      console.log("obligation_reprocess_job_processed", {
        index: index + 1,
        claimed: count,
      });
      if (count === 0) break;
    }
  } finally {
    await runtime.close();
  }

  const verificationDatabase = new PgPoolClient(createDatabaseConfig(loadEnv()));
  try {
    const after = await countRows(verificationDatabase);
    const sample = await verificationDatabase.query(
      `
        SELECT
          obligation.contract_id,
          obligation.title,
          obligation.anchors
        FROM obligations AS obligation
        ORDER BY obligation.created_at DESC
        LIMIT 5
      `,
    );
    console.log("obligation_reprocess_after", {
      ...after,
      enqueued,
      claimed,
      sampleAnchors: sample.rows,
    });
  } finally {
    await verificationDatabase.close();
  }
}

main().catch((error) => {
  console.error("obligation_reprocess_failed", error);
  process.exitCode = 1;
});
