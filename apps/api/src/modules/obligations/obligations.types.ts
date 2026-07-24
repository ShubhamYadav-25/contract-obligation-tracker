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
  readonly responsibleParty?: string;
  readonly counterparty?: string;
  readonly category?: string;
  readonly timingType?: string;
  readonly frequency?: string;
  readonly triggerEvent?: string;
  readonly offsetValue?: number;
  readonly offsetUnit?: string;
  readonly offsetDirection?: string;
  readonly confidence?: number;
  readonly reviewStatus?: string;
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
  readonly documentId?: string;
  readonly pageNumber: number;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly globalStartLine?: number;
  readonly globalEndLine?: number;
  readonly quotedText?: string;
  readonly source?: string;
  readonly evidenceRole?: string;
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

export interface ObligationEditableFields {
  readonly title?: string;
  readonly description?: string;
  readonly dueAt?: Date | null;
  readonly responsibleParty?: string | null;
  readonly counterparty?: string | null;
  readonly category?: string | null;
  readonly timingType?: string | null;
  readonly frequency?: string | null;
  readonly triggerEvent?: string | null;
  readonly offsetValue?: number | null;
  readonly offsetUnit?: string | null;
  readonly offsetDirection?: string | null;
  readonly reviewStatus?: string | null;
}
