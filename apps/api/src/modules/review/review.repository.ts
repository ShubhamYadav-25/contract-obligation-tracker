import type { ReviewDecisionInput } from "./review.types.js";

export interface ReviewRepository {
  listPendingCandidates(): Promise<readonly unknown[]>;
  recordDecision(input: ReviewDecisionInput): Promise<void>;
}
