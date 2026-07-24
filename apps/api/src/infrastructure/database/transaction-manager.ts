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
    const onClientError = () => {
      // Checked-out clients can emit connection errors outside the query promise chain.
      // Keep the process alive; the active query/commit/rollback will still reject.
    };
    client.on("error", onClientError);
    try {
      await client.query("BEGIN");
      const result = await work({ client });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original transaction failure when the connection is already broken.
      }
      throw error;
    } finally {
      client.off("error", onClientError);
      client.release();
    }
  }
}
