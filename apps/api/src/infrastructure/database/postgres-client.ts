import pg from "pg";

import type { DatabaseConfig } from "../../config/database.js";

const { Pool } = pg;

export interface QueryResult<Row = unknown> {
  readonly rows: readonly Row[];
  readonly rowCount: number;
}

export interface PostgreSqlClient {
  query<Row = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
  close(): Promise<void>;
}

export class PgPoolClient implements PostgreSqlClient {
  readonly pool: pg.Pool;

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
  }

  async query<Row = unknown>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    const result = await this.pool.query(sql, [...params]);
    return {
      rows: result.rows as Row[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
