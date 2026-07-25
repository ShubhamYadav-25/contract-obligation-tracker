/**
 * @file Defines PostgreSQL database infrastructure adapters and helpers.
 */
import type pg from "pg";

export interface TransactionContext {
  readonly client: pg.PoolClient;
}

export interface TransactionManager {
  inTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}

export class PgTransactionManager implements TransactionManager {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {pg.Pool} pool - Input value for pool.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly pool: pg.Pool) {}

  /**
   * @description Implements the in transaction method for this service or adapter.
   * @param {(context: TransactionContext) => Promise<T>} work - Input value for work.
   * @returns {Promise<T>} Result of the in transaction operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async inTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    /**
     * @description Performs the on client error helper operation for this module.
     * @returns {unknown} Result of the on client error operation.
     */
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
