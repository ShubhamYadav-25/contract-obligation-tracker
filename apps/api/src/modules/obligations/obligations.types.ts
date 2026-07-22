export type ObligationStatus = "UPCOMING" | "DUE" | "MET" | "MISSED";

export interface ObligationRecord {
  readonly id: string;
  readonly contractId: string;
  readonly contractDisplayName?: string;
  readonly title: string;
  readonly description: string;
  readonly status: ObligationStatus;
  readonly dueAt?: Date;
  readonly reminderStatus?: string;
  readonly nextReminderAt?: Date;
  readonly sourceAnchors: readonly ObligationSourceAnchor[];
  readonly version: number;
}

export interface ObligationSourceBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ObligationSourceAnchor {
  readonly pageNumber: number;
  readonly quotedText?: string;
  readonly boxes: readonly ObligationSourceBox[];
}

export interface ObligationTransitionHistoryRecord {
  readonly fromStatus: ObligationStatus;
  readonly toStatus: ObligationStatus;
  readonly actorId: string;
  readonly occurredAt: Date;
}

export interface ObligationDetailRecord extends ObligationRecord {
  readonly sourceText: string;
  readonly transitionHistory: readonly ObligationTransitionHistoryRecord[];
}

export interface ObligationTransitionInput {
  readonly obligationId: string;
  readonly fromStatus: ObligationStatus;
  readonly toStatus: ObligationStatus;
  readonly expectedVersion: number;
  readonly actorId: string;
}
