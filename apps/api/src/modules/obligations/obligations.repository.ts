/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ObligationDetailRecord,
  ObligationEditableFields,
  ObligationRecord,
  ObligationStatus,
} from "./obligations.types.js";

export interface ExtractedObligationInput {
  readonly title: string;
  readonly description: string;
  readonly dueAt?: Date;
  readonly anchors: readonly Record<string, unknown>[];
}

export type ObligationStatusCounts = Record<ObligationStatus, number>;
export type ObligationReminderFilter =
  | "PENDING"
  | "ENQUEUED"
  | "PROCESSING"
  | "DELIVERED"
  | "RETRY_PENDING"
  | "FAILED"
  | "CANCELLED"
  | "NONE";
export type ObligationDueDateRangeFilter = "OVERDUE" | "NEXT_7_DAYS" | "NEXT_30_DAYS";

export interface ListObligationsResult {
  readonly items: readonly ObligationRecord[];
  readonly total: number;
  readonly statusCounts: ObligationStatusCounts;
}

export interface ObligationRepository {
  listByOrganization(input: {
    readonly organizationId: string;
    readonly contractId?: string;
    readonly search?: string;
    readonly status?: ObligationStatus;
    readonly reminderStatus?: ObligationReminderFilter;
    readonly dueDateRange?: ObligationDueDateRangeFilter;
    readonly limit: number;
    readonly offset: number;
  }): Promise<ListObligationsResult>;
  findById(id: string): Promise<ObligationRecord | null>;
  findDetailByOrganizationAndId(input: {
    readonly organizationId: string;
    readonly obligationId: string;
  }): Promise<ObligationDetailRecord | null>;
  updateEditableFields(input: {
    readonly organizationId: string;
    readonly obligationId: string;
    readonly expectedVersion: number;
    readonly fields: ObligationEditableFields;
  }): Promise<ObligationRecord>;
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
