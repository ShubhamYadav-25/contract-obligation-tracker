/**
 * @file Defines PostgreSQL database infrastructure adapters and helpers.
 */
import pg from "pg";

import type { DatabaseConfig } from "../../config/database.js";
import { ApplicationError } from "../../shared/errors/application-error.js";

const { Pool } = pg;
const maxTransientQueryAttempts = 2;
const transientRetryDelayMilliseconds = 150;

export interface QueryResult<Row = unknown> {
  readonly rows: readonly Row[];
  readonly rowCount: number;
}

export interface PostgreSqlClient {
  query<Row = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
  close(): Promise<void>;
}

export class DatabaseConnectionError extends ApplicationError {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {unknown} error - Input value for error.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(error: unknown) {
    super({
      code: "DATABASE_UNAVAILABLE",
      message: "Database connection is unavailable",
      statusCode: 503,
      details: {
        reason: databaseFailureReason(error),
      },
    });
  }
}

/**
 * @description Performs the error message helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {string} Result of the error message operation.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @description Performs the error code helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {string | undefined} Result of the error code operation.
 */
function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code?: unknown }).code)
    : undefined;
}

/**
 * @description Performs the database failure reason helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {string} Result of the database failure reason operation.
 */
function databaseFailureReason(error: unknown): string {
  const code = errorCode(error);
  if (code === "ENOTFOUND" || /getaddrinfo\s+ENOTFOUND/i.test(errorMessage(error))) {
    return "DNS_LOOKUP_FAILED";
  }
  if (/timeout/i.test(errorMessage(error))) {
    return "CONNECTION_TIMEOUT";
  }
  if (/connection terminated/i.test(errorMessage(error))) {
    return "CONNECTION_TERMINATED";
  }
  return "CONNECTION_FAILED";
}

/**
 * @description Performs the is transient connection failure helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {boolean} Result of the is transient connection failure operation.
 */
function isTransientConnectionFailure(error: unknown): boolean {
  return new Set(["DNS_LOOKUP_FAILED", "CONNECTION_TIMEOUT", "CONNECTION_TERMINATED"]).has(
    databaseFailureReason(error),
  );
}

/**
 * @description Performs the delay helper operation for this module.
 * @param {number} milliseconds - Input value for milliseconds.
 * @returns {Promise<void>} Result of the delay operation.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class PgPoolClient implements PostgreSqlClient {
  readonly pool: pg.Pool;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {DatabaseConfig} config - Input value for config.
   * @returns {unknown} Result of the constructor operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  constructor(config: DatabaseConfig) {
    if (!config.connectionString) {
      throw new Error("DATABASE_URL is required to create a PostgreSQL pool");
    }

    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.poolMax,
      connectionTimeoutMillis: config.connectionTimeoutMilliseconds,
      idleTimeoutMillis: config.idleTimeoutMilliseconds,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });

    this.pool.on("error", () => {
      // Idle PostgreSQL clients can emit connection reset events outside query control flow.
      // Handling the pool event prevents transient network drops from crashing the API process.
    });
  }

  /**
   * @description Implements the query method for this service or adapter.
   * @param {string} sql - Input value for sql.
   * @param {readonly unknown[]} params - Input value for params.
   * @returns {Promise<QueryResult<Row>>} Result of the query operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async query<Row = unknown>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxTransientQueryAttempts; attempt += 1) {
      try {
        const result = await this.pool.query(sql, [...params]);
        return {
          rows: result.rows as Row[],
          rowCount: result.rowCount ?? 0,
        };
      } catch (error) {
        lastError = error;
        if (!isTransientConnectionFailure(error) || attempt >= maxTransientQueryAttempts) {
          throw new DatabaseConnectionError(error);
        }
        await delay(transientRetryDelayMilliseconds);
      }
    }

    throw new DatabaseConnectionError(lastError);
  }

  /**
   * @description Implements the close method for this service or adapter.
   * @returns {Promise<void>} Result of the close operation.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
