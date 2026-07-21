import type { ObligationStatus } from "@contract-obligation-tracker/shared";

export type { ObligationStatus };

export interface ObligationSummary {
  readonly id: string;
  readonly contractId: string;
  readonly title: string;
  readonly status: ObligationStatus;
  readonly dueAt?: string | undefined;
  readonly version: number;
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
