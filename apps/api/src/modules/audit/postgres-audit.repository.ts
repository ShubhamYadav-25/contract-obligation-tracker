/**
 * @file Defines backend audit module contracts, services, routes, or persistence logic.
 */
import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditRecordInput } from "./audit.types.js";

export class PostgresAuditRepository implements AuditRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Implements the append method for this service or adapter.
   * @param {AuditRecordInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<void>} Result of the append operation.
   */
  async append(input: AuditRecordInput, transaction?: TransactionContext): Promise<void> {
    const sql = `
      INSERT INTO audit_events (
        actor_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        previous_data,
        new_data,
        correlation_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
    `;
    const params = [
      input.actor.id,
      input.actor.type,
      input.action,
      input.entityType,
      input.entityId,
      input.previousData === undefined ? null : JSON.stringify(input.previousData),
      input.newData === undefined ? null : JSON.stringify(input.newData),
      input.correlationId,
      input.timestamp,
    ];

    if (transaction) {
      await transaction.client.query(sql, params);
      return;
    }

    await this.database.query(sql, params);
  }
}
