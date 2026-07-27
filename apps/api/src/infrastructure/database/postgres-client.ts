/**
 * @file Defines PostgreSQL database infrastructure adapters and helpers.
 */
import pg from "pg";

import type { DatabaseConfig } from "../../config/database.js";
import { ApplicationError } from "../../shared/errors/application-error.js";

const { Pool } = pg;
const maxTransientQueryAttempts = 3;
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
        driverCodes: nestedErrorCodes(error),
        driverMessage: safeDatabaseErrorMessage(error),
      },
    });
  }
}

function safeDatabaseErrorMessage(error: unknown): string {
  const messages: string[] = [];
  const visit = (candidate: unknown): void => {
    const message = errorMessage(candidate).trim();
    if (message) messages.push(message);
    if (candidate && typeof candidate === "object") {
      const errors = (candidate as { readonly errors?: unknown }).errors;
      if (Array.isArray(errors)) errors.forEach(visit);
      const cause = (candidate as { readonly cause?: unknown }).cause;
      if (cause) visit(cause);
    }
  };
  visit(error);
  return [...new Set(messages)]
    .join(" | ")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .slice(0, 500);
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

function nestedErrorCodes(error: unknown): readonly string[] {
  const codes = new Set<string>();
  const visit = (candidate: unknown): void => {
    const code = errorCode(candidate);
    if (code) codes.add(code);
    if (candidate && typeof candidate === "object") {
      const errors = (candidate as { readonly errors?: unknown }).errors;
      if (Array.isArray(errors)) errors.forEach(visit);
      const cause = (candidate as { readonly cause?: unknown }).cause;
      if (cause) visit(cause);
    }
  };
  visit(error);
  return [...codes];
}

/**
 * @description Performs the database failure reason helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {string} Result of the database failure reason operation.
 */
function databaseFailureReason(error: unknown): string {
  const codes = nestedErrorCodes(error);
  const message = errorMessage(error);
  if (codes.includes("ENOTFOUND") || /getaddrinfo\s+ENOTFOUND/i.test(message)) {
    return "DNS_LOOKUP_FAILED";
  }
  if (codes.includes("ETIMEDOUT") || /timeout/i.test(message)) {
    return "CONNECTION_TIMEOUT";
  }
  if (
    codes.some((code) => ["ECONNRESET", "EPIPE", "57P01", "57P02", "57P03"].includes(code)) ||
    /connection terminated|connection reset|socket hang up/i.test(message)
  ) {
    return "CONNECTION_TERMINATED";
  }
  if (codes.includes("ECONNREFUSED")) return "CONNECTION_REFUSED";
  if (codes.includes("EACCES") || codes.includes("EPERM")) return "NETWORK_ACCESS_DENIED";
  if (/remaining connection slots|too many clients|connection pool/i.test(message)) {
    return "CONNECTION_CAPACITY_EXHAUSTED";
  }
  if (codes.includes("28P01")) return "AUTHENTICATION_FAILED";
  if (codes.includes("3D000")) return "DATABASE_NOT_FOUND";
  return "CONNECTION_FAILED";
}

function isDatabaseConnectionFailure(error: unknown): boolean {
  return databaseFailureReason(error) !== "CONNECTION_FAILED";
}

/**
 * @description Performs the is transient connection failure helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {boolean} Result of the is transient connection failure operation.
 */
function isTransientConnectionFailure(error: unknown): boolean {
  return new Set(["DNS_LOOKUP_FAILED", "CONNECTION_TIMEOUT", "CONNECTION_TERMINATED"]).has(
    databaseFailureReason(error),
  ) ||
    new Set([
      "CONNECTION_REFUSED",
      "NETWORK_ACCESS_DENIED",
      "CONNECTION_CAPACITY_EXHAUSTED",
    ]).has(databaseFailureReason(error));
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
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
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
        if (!isDatabaseConnectionFailure(error)) {
          throw error;
        }
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
