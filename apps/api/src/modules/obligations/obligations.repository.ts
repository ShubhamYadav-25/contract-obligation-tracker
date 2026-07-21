import type { ObligationRecord, ObligationStatus } from "./obligations.types.js";

export interface ObligationRepository {
  findById(id: string): Promise<ObligationRecord | null>;
  updateStatus(input: {
    readonly id: string;
    readonly fromStatus: ObligationStatus;
    readonly toStatus: ObligationStatus;
    readonly expectedVersion: number;
  }): Promise<ObligationRecord>;
}
