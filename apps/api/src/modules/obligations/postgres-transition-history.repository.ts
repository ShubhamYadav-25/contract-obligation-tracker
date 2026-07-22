import type { ObligationTransitionHistoryRepository } from "./transition-history.repository.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";

export class PostgresTransitionHistoryRepository implements ObligationTransitionHistoryRepository {
  constructor(private readonly transactions: TransactionManager) {}

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
