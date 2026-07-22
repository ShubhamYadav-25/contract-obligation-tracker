import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ObligationDetailRecord,
  ObligationRecord,
  ObligationStatus,
} from "./obligations.types.js";

export interface ExtractedObligationInput {
  readonly title: string;
  readonly description: string;
  readonly dueAt?: Date;
  readonly anchors: readonly Record<string, unknown>[];
}

export interface ObligationRepository {
  listByOrganization(input: {
    readonly organizationId: string;
    readonly contractId?: string;
    readonly search?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly ObligationRecord[]>;
  findById(id: string): Promise<ObligationRecord | null>;
  findDetailByOrganizationAndId(input: {
    readonly organizationId: string;
    readonly obligationId: string;
  }): Promise<ObligationDetailRecord | null>;
  updateStatus(input: {
    readonly id: string;
    readonly fromStatus: ObligationStatus;
    readonly toStatus: ObligationStatus;
    readonly expectedVersion: number;
  }): Promise<ObligationRecord>;
  upsertExtractedForContract(
    input: {
      readonly contractId: string;
      readonly obligations: readonly ExtractedObligationInput[];
    },
    transaction: TransactionContext,
  ): Promise<readonly ObligationRecord[]>;
}
