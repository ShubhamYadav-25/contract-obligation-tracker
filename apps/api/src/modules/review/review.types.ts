export type ReviewDecision = "APPROVE" | "REJECT";

export interface ReviewActor {
  readonly id: string;
  readonly type: "USER" | "SYSTEM";
}

export interface ReviewDecisionInput {
  readonly candidateId: string;
  readonly decision: ReviewDecision;
  readonly actor: ReviewActor;
  readonly reason?: string;
}
