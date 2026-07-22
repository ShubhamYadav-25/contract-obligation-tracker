import type { ObligationStatus } from "@contract-obligation-tracker/shared";

export type { ObligationStatus };

export interface ObligationSummary {
  readonly id: string;
  readonly contractId: string;
  readonly contractDisplayName?: string | null | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly status: ObligationStatus;
  readonly dueAt?: string | undefined;
  readonly reminderStatus?: string | null | undefined;
  readonly nextReminderAt?: string | null | undefined;
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
  readonly quotedText?: string | undefined;
  readonly boxes: readonly ObligationSourceBox[];
}

export interface ObligationDetail extends ObligationSummary {
  readonly description: string;
  readonly sourceText: string;
  readonly transitionHistory: readonly ObligationTransition[];
}

export interface ObligationTransition {
  readonly fromStatus: ObligationStatus;
  readonly toStatus: ObligationStatus;
  readonly actor: string;
  readonly occurredAt: string;
}
