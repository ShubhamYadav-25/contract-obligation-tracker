import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { ObligationRecord, ObligationStatus } from "./obligations.types.js";
import type { ObligationRepository } from "./obligations.repository.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";

export class PostgresObligationRepository implements ObligationRepository {
  constructor(private readonly transactions: TransactionManager) {}

  async findById(id: string): Promise<ObligationRecord | null> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `
        SELECT id, contract_id, title, description, status, due_at, version
        FROM obligations
        WHERE id = $1
      `,
        [id],
      );

      if (result.rowCount === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        contractId: row.contract_id,
        title: row.title,
        description: row.description,
        status: row.status as ObligationStatus,
        ...(row.due_at ? { dueAt: new Date(row.due_at) } : {}),
        version: Number(row.version),
      };
    });
  }

  async updateStatus(input: {
    readonly id: string;
    readonly fromStatus: ObligationStatus;
    readonly toStatus: ObligationStatus;
    readonly expectedVersion: number;
  }): Promise<ObligationRecord> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `
        UPDATE obligations
        SET status = $3::obligation_status,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1
          AND status = $2::obligation_status
          AND version = $4
        RETURNING id, contract_id, title, description, status, due_at, version
      `,
        [input.id, input.fromStatus, input.toStatus, input.expectedVersion],
      );

      if (result.rowCount === 0) {
        // Either obligation not found, concurrent update/version mismatch, or invalid fromStatus
        const exists = await client.query(`SELECT status, version FROM obligations WHERE id = $1`, [input.id]);
        if (exists.rowCount === 0) {
          throw new NotFoundError("Obligation not found", { obligationId: input.id });
        }
        // Surface a clear error for invalid transition or version mismatch
        throw new Error("Obligation update failed due to status/version mismatch");
      }

      const row = result.rows[0];
      return {
        id: row.id,
        contractId: row.contract_id,
        title: row.title,
        description: row.description,
        status: row.status as ObligationStatus,
        ...(row.due_at ? { dueAt: new Date(row.due_at) } : {}),
        version: Number(row.version),
      };
    });
  }
}
