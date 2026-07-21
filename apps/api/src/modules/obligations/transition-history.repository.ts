import type { ObligationStatus } from "./obligations.types.js";

export interface ObligationTransitionHistoryRepository {
  record(input: {
    readonly obligationId: string;
    readonly fromStatus: ObligationStatus;
    readonly toStatus: ObligationStatus;
    readonly actorId: string;
    readonly occurredAt: Date;
  }): Promise<void>;
}
