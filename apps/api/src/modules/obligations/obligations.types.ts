export type ObligationStatus = "UPCOMING" | "DUE" | "MET" | "MISSED";

export interface ObligationRecord {
  readonly id: string;
  readonly contractId: string;
  readonly title: string;
  readonly description: string;
  readonly status: ObligationStatus;
  readonly dueAt?: Date;
  readonly version: number;
}

export interface ObligationTransitionInput {
  readonly obligationId: string;
  readonly fromStatus: ObligationStatus;
  readonly toStatus: ObligationStatus;
  readonly expectedVersion: number;
  readonly actorId: string;
}
