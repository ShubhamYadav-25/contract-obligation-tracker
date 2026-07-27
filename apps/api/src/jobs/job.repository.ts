/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { PostgreSqlClient } from "../infrastructure/database/postgres-client.js";
import type { TransactionManager } from "../infrastructure/database/transaction-manager.js";
import type {
  BackgroundJob,
  ClaimJobsInput,
  CompleteJobInput,
  CreateBackgroundJobInput,
  FailJobInput,
} from "./job.types.js";

interface BackgroundJobRow {
  readonly id: string;
  readonly job_type: string;
  readonly idempotency_key: string;
  readonly payload: unknown;
  readonly status: BackgroundJob["status"];
  readonly priority: number;
  readonly available_at: Date;
  readonly attempt_count: number;
  readonly max_attempts: number;
  readonly locked_by: string | null;
  readonly locked_at: Date | null;
  readonly lock_expires_at: Date | null;
  readonly last_error: string | null;
  readonly completed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * @description Performs the map job helper operation for this module.
 * @param {BackgroundJobRow} row - Input value for row.
 * @returns {BackgroundJob} Result of the map job operation.
 */
function mapJob(row: BackgroundJobRow): BackgroundJob {
  return {
    id: row.id,
    jobType: row.job_type,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    status: row.status,
    priority: row.priority,
    availableAt: row.available_at,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    ...(row.locked_by ? { lockedBy: row.locked_by } : {}),
    ...(row.locked_at ? { lockedAt: row.locked_at } : {}),
    ...(row.lock_expires_at ? { lockExpiresAt: row.lock_expires_at } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface JobRepository {
  createJob(input: CreateBackgroundJobInput): Promise<BackgroundJob>;
  claimJobs(input: ClaimJobsInput): Promise<readonly BackgroundJob[]>;
  renewLock(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly lockDurationMilliseconds: number;
  }): Promise<boolean>;
  markCompleted(input: CompleteJobInput): Promise<void>;
  markFailed(input: FailJobInput): Promise<void>;
  recoverExpiredJobs(now: Date): Promise<readonly BackgroundJob[]>;
}

export class PostgresJobRepository implements JobRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @param {TransactionManager} transactions - Input value for transactions.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly database: PostgreSqlClient,
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * @description Executes the create job operation used by the application workflow.
   * @param {CreateBackgroundJobInput} input - Input value for input.
   * @returns {Promise<BackgroundJob>} Result of the create job operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async createJob(input: CreateBackgroundJobInput): Promise<BackgroundJob> {
    const result = await this.database.query<BackgroundJobRow>(
      `
        INSERT INTO background_jobs (
          job_type,
          idempotency_key,
          payload,
          priority,
          available_at,
          max_attempts
        )
        VALUES ($1, $2, $3::jsonb, $4, COALESCE($5::timestamptz, NOW()), $6)
        ON CONFLICT (idempotency_key)
        DO UPDATE SET updated_at = background_jobs.updated_at
        RETURNING *
      `,
      [
        input.jobType,
        input.idempotencyKey,
        JSON.stringify(input.payload),
        input.priority ?? 0,
        input.availableAt ?? null,
        input.maxAttempts ?? 5,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Background job insert returned no row");
    }
    return mapJob(row);
  }

  /**
   * @description Implements the claim jobs method for this service or adapter.
   * @param {ClaimJobsInput} input - Input value for input.
   * @returns {Promise<readonly BackgroundJob[]>} Result of the claim jobs operation.
   */
  async claimJobs(input: ClaimJobsInput): Promise<readonly BackgroundJob[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<BackgroundJobRow>(
        `
          WITH claimable_jobs AS (
            SELECT id
            FROM background_jobs
            WHERE status IN ('PENDING', 'RETRY_PENDING')
              AND available_at <= NOW()
            ORDER BY priority DESC, available_at, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT $1
          )
          UPDATE background_jobs AS job
          SET
            status = 'PROCESSING',
            locked_by = $2,
            locked_at = NOW(),
            lock_expires_at = NOW() + ($3::double precision * interval '1 millisecond'),
            attempt_count = attempt_count + 1,
            updated_at = NOW()
          FROM claimable_jobs
          WHERE job.id = claimable_jobs.id
          RETURNING job.*
        `,
        [input.limit, input.workerId, input.lockDurationMilliseconds],
      );

      return result.rows.map(mapJob);
    });
  }

  async renewLock(input: {
    readonly jobId: string;
    readonly workerId: string;
    readonly lockDurationMilliseconds: number;
  }): Promise<boolean> {
    const result = await this.database.query(
      `
        UPDATE background_jobs
        SET
          lock_expires_at = NOW() + ($3::double precision * interval '1 millisecond'),
          updated_at = NOW()
        WHERE id = $1
          AND locked_by = $2
          AND status = 'PROCESSING'
      `,
      [input.jobId, input.workerId, input.lockDurationMilliseconds],
    );
    return result.rowCount === 1;
  }

  /**
   * @description Implements the mark completed method for this service or adapter.
   * @param {CompleteJobInput} input - Input value for input.
   * @returns {Promise<void>} Result of the mark completed operation.
   */
  async markCompleted(input: CompleteJobInput): Promise<void> {
    await this.database.query(
      `
        UPDATE background_jobs
        SET
          status = 'COMPLETED',
          completed_at = NOW(),
          locked_by = NULL,
          locked_at = NULL,
          lock_expires_at = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND locked_by = $2
          AND status = 'PROCESSING'
      `,
      [input.jobId, input.workerId],
    );
  }

  /**
   * @description Implements the mark failed method for this service or adapter.
   * @param {FailJobInput} input - Input value for input.
   * @returns {Promise<void>} Result of the mark failed operation.
   */
  async markFailed(input: FailJobInput): Promise<void> {
    await this.database.query(
      `
        UPDATE background_jobs
        SET
          status = CASE
            WHEN $3::boolean AND attempt_count < max_attempts THEN 'RETRY_PENDING'::job_status
            ELSE 'FAILED'::job_status
          END,
          available_at = CASE
            WHEN $3::boolean AND attempt_count < max_attempts THEN COALESCE($4::timestamptz, NOW())
            ELSE available_at
          END,
          last_error = $5,
          locked_by = NULL,
          locked_at = NULL,
          lock_expires_at = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND locked_by = $2
          AND status = 'PROCESSING'
      `,
      [
        input.jobId,
        input.workerId,
        input.retryable,
        input.nextAvailableAt ?? null,
        input.errorMessage,
      ],
    );
  }

  /**
   * @description Implements the recover expired jobs method for this service or adapter.
   * @param {Date} now - Input value for now.
   * @returns {Promise<readonly BackgroundJob[]>} Result of the recover expired jobs operation.
   */
  async recoverExpiredJobs(now: Date): Promise<readonly BackgroundJob[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<BackgroundJobRow>(
        `
          UPDATE background_jobs
          SET
            status = CASE
              WHEN attempt_count < max_attempts THEN 'RETRY_PENDING'::job_status
              ELSE 'FAILED'::job_status
            END,
            available_at = $1,
            last_error = COALESCE(last_error, 'Recovered expired processing lock'),
            locked_by = NULL,
            locked_at = NULL,
            lock_expires_at = NULL,
            updated_at = NOW()
          WHERE status = 'PROCESSING'
            AND lock_expires_at < $1
          RETURNING *
        `,
        [now],
      );

      for (const row of result.rows) {
        if (row.job_type !== "PROCESS_CONTRACT") continue;
        const payload =
          row.payload && typeof row.payload === "object"
            ? (row.payload as Record<string, unknown>)
            : {};
        const processingRunId =
          typeof payload.processingRunId === "string" ? payload.processingRunId : null;
        if (!processingRunId) continue;
        const retryPending = row.status === "RETRY_PENDING";
        await client.query(
          `
            UPDATE contract_processing_runs
            SET
              status = CASE WHEN $3::boolean THEN 'QUEUED' ELSE 'FAILED' END,
              error_code = 'JOB_LOCK_EXPIRED',
              error_stage = 'QUEUE',
              error_message = 'Background processing lease expired',
              error_retryable = $3,
              completed_at = CASE WHEN $3::boolean THEN NULL ELSE $4::timestamptz END,
              failed_at = CASE WHEN $3::boolean THEN NULL ELSE $4::timestamptz END,
              updated_at = $4::timestamptz
            WHERE id = $1
              AND queue_job_id = $2
              AND status IN ('PROCESSING', 'PARSING', 'OCR_PROCESSING', 'TEXT_SEGMENTED')
          `,
          [processingRunId, row.idempotency_key, retryPending, now],
        );
      }

      return result.rows.map(mapJob);
    });
  }
}
