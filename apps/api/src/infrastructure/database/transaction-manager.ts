import type pg from "pg";

export interface TransactionContext {
  readonly client: pg.PoolClient;
}

export interface TransactionManager {
  inTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}

export class PgTransactionManager implements TransactionManager {
  constructor(private readonly pool: pg.Pool) {}

  async inTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work({ client });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
