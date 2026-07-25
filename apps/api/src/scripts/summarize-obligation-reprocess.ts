/**
 * @file Defines a backend operational script for local maintenance or diagnostics.
 */
import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";

/**
 * @description Runs the main script step for local operations.
 * @returns {Promise<void>} Result of the main operation.
 */
async function main(): Promise<void> {
  const database = new PgPoolClient(createDatabaseConfig(loadEnv()));

  try {
    const counts = await database.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM contracts) AS contracts,
          (SELECT COUNT(*)::int FROM contract_documents WHERE upload_status = 'STORED') AS stored_documents,
          (SELECT COUNT(*)::int FROM contract_processing_runs) AS processing_runs,
          (SELECT COUNT(*)::int FROM obligations) AS obligations,
          (SELECT COUNT(*)::int FROM obligations WHERE anchors::text LIKE '%"boxes"%') AS obligations_with_boxes,
          (
            SELECT COUNT(*)::int
            FROM background_jobs
            WHERE job_type = 'PROCESS_CONTRACT'
              AND status IN ('PENDING', 'RETRY_PENDING', 'PROCESSING')
          ) AS active_contract_jobs,
          (
            SELECT COUNT(*)::int
            FROM background_jobs
            WHERE idempotency_key LIKE '%obligation-reprocess%'
              AND status = 'COMPLETED'
          ) AS completed_reprocess_jobs,
          (
            SELECT COUNT(*)::int
            FROM background_jobs
            WHERE idempotency_key LIKE '%obligation-reprocess%'
              AND status = 'FAILED'
          ) AS failed_reprocess_jobs
      `,
    );
    const samples = await database.query(
      `
        SELECT
          obligation.contract_id,
          contract.display_name,
          obligation.title,
          obligation.anchors
        FROM obligations AS obligation
        INNER JOIN contracts AS contract
          ON contract.id = obligation.contract_id
        ORDER BY obligation.created_at DESC
        LIMIT 5
      `,
    );
    const anchorSources = await database.query(
      `
        SELECT
          anchor.value ->> 'source' AS source,
          COUNT(*)::int AS count
        FROM obligations AS obligation
        CROSS JOIN LATERAL jsonb_array_elements(obligation.anchors) AS anchor(value)
        GROUP BY anchor.value ->> 'source'
        ORDER BY count DESC
      `,
    );
    const reprocessJobs = await database.query(
      `
        SELECT
          status,
          COUNT(*)::int AS count,
          MAX(last_error) AS last_error
        FROM background_jobs
        WHERE idempotency_key LIKE '%obligation-reprocess%'
        GROUP BY status
        ORDER BY status
      `,
    );
    const extractionAudits = await database.query(
      `
        SELECT
          new_data ->> 'extractionProvider' AS provider,
          COUNT(*)::int AS count
        FROM audit_events
        WHERE action = 'CONTRACT_OBLIGATIONS_EXTRACTED'
          AND new_data ? 'extractionProvider'
        GROUP BY new_data ->> 'extractionProvider'
        ORDER BY count DESC
      `,
    );
    const failedJobs = await database.query(
      `
        SELECT
          id,
          payload,
          last_error
        FROM background_jobs
        WHERE idempotency_key LIKE '%obligation-reprocess%'
          AND status = 'FAILED'
        ORDER BY updated_at DESC
        LIMIT 5
      `,
    );

    console.log(
      JSON.stringify(
        {
          counts: counts.rows[0] ?? {},
          anchorSources: anchorSources.rows,
          reprocessJobs: reprocessJobs.rows,
          extractionAudits: extractionAudits.rows,
          failedJobs: failedJobs.rows,
          sampleAnchors: samples.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error("obligation_reprocess_summary_failed", error);
  process.exitCode = 1;
});
