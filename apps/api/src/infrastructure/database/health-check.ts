/**
 * @file Defines PostgreSQL database infrastructure adapters and helpers.
 */
import type { PostgreSqlClient } from "./postgres-client.js";

export class DatabaseHealthCheck {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} client - Input value for client.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly client: PostgreSqlClient) {}

  /**
   * @description Implements the check method for this service or adapter.
   * @returns {Promise<{ readonly ok: boolean }>} Result of the check operation.
   */
  async check(): Promise<{ readonly ok: boolean }> {
    await this.client.query("select 1 as ok");
    return { ok: true };
  }
}
