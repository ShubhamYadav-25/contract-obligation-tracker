/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import type { ObligationTransitionHistoryRepository } from "./transition-history.repository.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";

export class PostgresTransitionHistoryRepository implements ObligationTransitionHistoryRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {TransactionManager} transactions - Input value for transactions.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * @description Implements the record method for this service or adapter.
   * @param {{ readonly obligationId: string; readonly fromStatus: string; readonly toStatus: string; readonly actorId: string; readonly occurredAt: Date; }} input - Input value for input.
   * @returns {Promise<void>} Result of the record operation.
   */
  async record(input: {
    readonly obligationId: string;
    readonly fromStatus: string;
    readonly toStatus: string;
    readonly actorId: string;
    readonly occurredAt: Date;
  }): Promise<void> {
    await this.transactions.inTransaction(async ({ client }) => {
      await client.query(
        `
        INSERT INTO obligation_transition_history (
          obligation_id, from_status, to_status, actor_id, occurred_at
        ) VALUES ($1, $2::obligation_status, $3::obligation_status, $4, $5)
      `,
        [input.obligationId, input.fromStatus, input.toStatus, input.actorId, input.occurredAt],
      );
    });
  }
}
