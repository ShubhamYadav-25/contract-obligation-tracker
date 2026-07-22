import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { PostgresJobRepository } from "../jobs/job.repository.js";
import { PostgresContractProcessingRepository } from "../modules/contracts/postgres-contract.repository.js";

interface PendingProcessingRunRow {
  readonly organization_id: string;
  readonly contract_id: string;
  readonly document_id: string;
  readonly processing_run_id: string;
  readonly status: string;
}

function readLimit(): number {
  const value = process.env.CONTRACT_PROCESSING_BACKFILL_LIMIT;
  if (!value) return 100;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("CONTRACT_PROCESSING_BACKFILL_LIMIT must be a positive integer");
  }
  return parsed;
}

function readReprocessCompleted(): boolean {
  const value = process.env.CONTRACT_PROCESSING_REPROCESS_COMPLETED;
  return value === "true" || value === "1";
}

function queueKey(row: PendingProcessingRunRow, batchId: string, index: number): string {
  return `contract-processing:${row.document_id}:backfill:${batchId}:${index + 1}`;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobs = new PostgresJobRepository(database, transactions);
  const processingRuns = new PostgresContractProcessingRepository(database);
  const reprocessCompleted = readReprocessCompleted();
  const statuses = reprocessCompleted
    ? ["STORED", "QUEUED", "TEXT_SEGMENTED", "COMPLETED", "REVIEW_REQUIRED", "FAILED"]
    : ["STORED", "QUEUED", "TEXT_SEGMENTED"];
  const limit = readLimit();
  const batchId = Date.now().toString(36);

  try {
    const result = await database.query<PendingProcessingRunRow>(
      `
        SELECT
          contract.organization_id,
          run.contract_id,
          run.document_id,
          run.id AS processing_run_id,
          run.status
        FROM contract_processing_runs AS run
        INNER JOIN contracts AS contract
          ON contract.id = run.contract_id
        INNER JOIN contract_documents AS document
          ON document.id = run.document_id
          AND document.contract_id = run.contract_id
        WHERE run.status = ANY($1::text[])
          AND document.upload_status = 'STORED'
          AND NOT EXISTS (
            SELECT 1
            FROM contract_processing_runs AS newer_run
            WHERE newer_run.contract_id = run.contract_id
              AND newer_run.created_at > run.created_at
          )
          AND (
            run.status <> 'QUEUED'
            OR run.queue_job_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM background_jobs AS job
              WHERE job.idempotency_key = run.queue_job_id
                AND job.status IN ('PENDING', 'RETRY_PENDING', 'PROCESSING')
            )
          )
          AND (
            $3::boolean
            OR run.status <> 'TEXT_SEGMENTED'
            OR NOT EXISTS (
              SELECT 1
              FROM obligations AS obligation
              WHERE obligation.contract_id = run.contract_id
            )
          )
        ORDER BY run.created_at ASC
        LIMIT $2
      `,
      [statuses, limit, reprocessCompleted],
    );

    let enqueued = 0;
    for (const [index, row] of result.rows.entries()) {
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
        maxAttempts: 5,
      });
      await processingRuns.markQueued({
        processingRunId: row.processing_run_id,
        queueJobId: idempotencyKey,
      });
      enqueued += 1;
      console.log("contract_processing_enqueued", {
        processingRunId: row.processing_run_id,
        contractId: row.contract_id,
        documentId: row.document_id,
        previousStatus: row.status,
        queueJobId: idempotencyKey,
      });
    }

    console.log("contract_processing_backfill_complete", {
      scanned: result.rowCount,
      enqueued,
      limit,
      reprocessCompleted,
    });
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error("contract_processing_backfill_failed", error);
  process.exitCode = 1;
});
