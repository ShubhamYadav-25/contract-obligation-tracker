import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { PostgresJobRepository } from "../jobs/job.repository.js";
import { PostgresContractProcessingRepository } from "../modules/contracts/postgres-contract.repository.js";

interface FailedJobRow {
  readonly payload: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly documentId: string;
    readonly processingRunId: string;
  };
}

async function main(): Promise<void> {
  const database = new PgPoolClient(createDatabaseConfig(loadEnv()));
  const transactions = new PgTransactionManager(database.pool);
  const jobs = new PostgresJobRepository(database, transactions);
  const processingRuns = new PostgresContractProcessingRepository(database);
  const batchId = Date.now().toString(36);

  try {
    const failed = await database.query<FailedJobRow>(
      `
        SELECT payload
        FROM background_jobs
        WHERE idempotency_key LIKE '%obligation-reprocess%'
          AND status = 'FAILED'
        ORDER BY updated_at DESC
      `,
    );

    let enqueued = 0;
    for (const [index, row] of failed.rows.entries()) {
      const payload = row.payload;
      const idempotencyKey = `contract-processing:${payload.documentId}:obligation-reprocess-recovery:${batchId}:${index + 1}`;
      await jobs.createJob({
        jobType: "PROCESS_CONTRACT",
        idempotencyKey,
        payload,
        priority: 100,
        maxAttempts: 1,
      });
      await processingRuns.markQueued({
        processingRunId: payload.processingRunId,
        queueJobId: idempotencyKey,
      });
      enqueued += 1;
      console.log("failed_obligation_reprocess_requeued", {
        contractId: payload.contractId,
        documentId: payload.documentId,
        processingRunId: payload.processingRunId,
        queueJobId: idempotencyKey,
      });
    }

    console.log("failed_obligation_reprocess_requeue_complete", { enqueued });
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error("failed_obligation_reprocess_requeue_failed", error);
  process.exitCode = 1;
});
