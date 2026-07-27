import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";

export class OperationsReadRepository {
  constructor(private readonly database: PostgreSqlClient) {}

  async processingHistory(organizationId: string, contractId: string) {
    const result = await this.database.query(
      `SELECT run.id, run.document_id AS "documentId", run.status,
              run.attempt_number AS "attemptNumber", run.queue_job_id AS "queueJobId",
              run.error_code AS "errorCode", run.error_stage AS "errorStage",
              run.error_message AS "errorMessage", run.started_at AS "startedAt",
              run.completed_at AS "completedAt", run.failed_at AS "failedAt",
              run.created_at AS "createdAt", run.updated_at AS "updatedAt"
       FROM contract_processing_runs run
       JOIN contracts contract ON contract.id = run.contract_id
       WHERE contract.organization_id = $1 AND run.contract_id = $2
       ORDER BY run.created_at DESC`,
      [organizationId, contractId],
    );
    return result.rows;
  }

  async activity(organizationId: string, contractId: string, limit: number, offset: number) {
    const result = await this.database.query(
      `SELECT event.id, event.actor_id AS "actorId", event.actor_type AS "actorType",
              event.action, event.entity_type AS "entityType", event.entity_id AS "entityId",
              event.previous_data AS "previousData", event.new_data AS "newData",
              event.correlation_id AS "correlationId", event.created_at AS "createdAt",
              COUNT(*) OVER()::int AS "total"
       FROM audit_events event
       WHERE event.entity_id = $2
         AND EXISTS (
           SELECT 1 FROM contracts contract
           WHERE contract.id = $2::uuid AND contract.organization_id = $1
         )
       ORDER BY event.created_at DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, contractId, limit, offset],
    );
    return {
      items: result.rows.map(({ total: _total, ...row }: any) => row),
      total: Number((result.rows[0] as any)?.total ?? 0),
    };
  }

  async overview(organizationId: string) {
    const [kpis, attention, deadlines] = await Promise.all([
      this.database.query(
        `SELECT
           (SELECT COUNT(*)::int FROM contracts WHERE organization_id = $1) AS "totalContracts",
           (SELECT COUNT(*)::int FROM contracts
              WHERE organization_id = $1 AND created_at >= date_trunc('month', NOW())) AS "uploadedThisMonth",
           (SELECT COUNT(*)::int FROM contract_processing_runs run
              JOIN contracts contract ON contract.id = run.contract_id
              WHERE contract.organization_id = $1
                AND run.status IN ('RECEIVED','STORED','QUEUED','PROCESSING','PARSING','OCR_PROCESSING','TEXT_SEGMENTED')
                AND NOT EXISTS (
                  SELECT 1 FROM contract_processing_runs newer
                  WHERE newer.contract_id = run.contract_id AND newer.created_at > run.created_at
                )) AS processing,
           (SELECT COUNT(*)::int FROM extraction_candidates candidate
              JOIN contracts contract ON contract.id = candidate.contract_id
              WHERE contract.organization_id = $1 AND candidate.status = 'PENDING_REVIEW') AS "awaitingReview",
           (SELECT COUNT(*)::int FROM extraction_candidates candidate
              JOIN contracts contract ON contract.id = candidate.contract_id
              WHERE contract.organization_id = $1 AND candidate.status = 'PENDING_REVIEW'
                AND candidate.confidence < 0.7) AS "lowConfidenceItems",
           (SELECT COUNT(*)::int FROM contract_processing_runs run
              JOIN contracts contract ON contract.id = run.contract_id
              WHERE contract.organization_id = $1 AND run.status IN ('PROCESSING','PARSING','OCR_PROCESSING')
                AND NOT EXISTS (
                  SELECT 1 FROM contract_processing_runs newer
                  WHERE newer.contract_id = run.contract_id AND newer.created_at > run.created_at
                )) AS extracting,
           (SELECT COUNT(*)::int FROM contract_processing_runs run
              JOIN contracts contract ON contract.id = run.contract_id
              WHERE contract.organization_id = $1 AND run.status = 'QUEUED'
                AND NOT EXISTS (
                  SELECT 1 FROM contract_processing_runs newer
                  WHERE newer.contract_id = run.contract_id AND newer.created_at > run.created_at
                )) AS queued,
           (SELECT COUNT(*)::int FROM obligations obligation
              JOIN contracts contract ON contract.id = obligation.contract_id
              WHERE contract.organization_id = $1 AND obligation.status IN ('UPCOMING','DUE')
                AND obligation.due_at <= NOW() + INTERVAL '30 days') AS "dueSoon",
           (SELECT COUNT(*)::int FROM obligations obligation
              JOIN contracts contract ON contract.id = obligation.contract_id
              WHERE contract.organization_id = $1 AND obligation.status = 'MISSED') AS missed,
           (SELECT COUNT(*)::int FROM obligations obligation
              JOIN contracts contract ON contract.id = obligation.contract_id
              WHERE contract.organization_id = $1 AND obligation.status = 'MISSED')
              AS "permanentAuditActionNeeded"`,
        [organizationId],
      ),
      this.database.query(
        `(SELECT run.id::text, contract.id::text AS "contractId", 'PROCESSING_FAILED' AS type,
                 'Processing failed' AS title, contract.display_name AS "contractName",
                 COALESCE(run.error_message, 'Processing stopped before completion') AS description,
                 run.updated_at AS timestamp, 'RETRY' AS action
          FROM contract_processing_runs run
          JOIN contracts contract ON contract.id = run.contract_id
          WHERE contract.organization_id = $1 AND run.status = 'FAILED'
          ORDER BY run.updated_at DESC LIMIT 5)
         UNION ALL
         (SELECT candidate.id::text, contract.id::text, 'REVIEW', 'Extraction review required',
                 contract.display_name, array_to_string(candidate.validation_issues, '; '),
                 candidate.created_at, 'REVIEW'
          FROM extraction_candidates candidate
          JOIN contracts contract ON contract.id = candidate.contract_id
          WHERE contract.organization_id = $1 AND candidate.status = 'PENDING_REVIEW'
          ORDER BY candidate.created_at ASC LIMIT 5)
         ORDER BY timestamp DESC LIMIT 8`,
        [organizationId],
      ),
      this.database.query(
        `SELECT obligation.id::text, obligation.contract_id::text AS "contractId",
                obligation.title, contract.display_name AS "contractName",
                obligation.due_at AS "dueDate", NULL::text AS owner,
                obligation.status
         FROM obligations obligation
         JOIN contracts contract ON contract.id = obligation.contract_id
         WHERE contract.organization_id = $1
           AND obligation.status <> 'MET' AND obligation.due_at IS NOT NULL
         ORDER BY obligation.due_at ASC LIMIT 8`,
        [organizationId],
      ),
    ]);
    return { kpis: kpis.rows[0] ?? {}, attentionRequired: attention.rows, upcomingDeadlines: deadlines.rows };
  }

  async reviewQueue(organizationId: string, limit: number, offset: number) {
    const result = await this.database.query(
      `SELECT candidate.id::text, candidate.contract_id::text AS "contractId",
              contract.display_name AS "contractName", candidate.document_id::text AS "documentId",
              candidate.extracted_json AS "extractedData", candidate.validation_issues AS "reviewReasons",
              candidate.confidence::float8 AS "confidenceScore", candidate.created_at AS "queuedAt",
              candidate.status, COUNT(*) OVER()::int AS total
       FROM extraction_candidates candidate
       JOIN contracts contract ON contract.id = candidate.contract_id
       WHERE contract.organization_id = $1 AND candidate.status = 'PENDING_REVIEW'
       ORDER BY candidate.created_at ASC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset],
    );
    return {
      items: result.rows.map(({ total: _total, ...row }: any) => row),
      total: Number((result.rows[0] as any)?.total ?? 0),
    };
  }
}
