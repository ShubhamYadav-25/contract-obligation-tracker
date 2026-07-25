/**
 * @file Defines backend review module contracts, services, routes, or persistence logic.
 */
import type { ReviewDecisionInput } from "./review.types.js";

export interface ReviewRepository {
  listPendingCandidates(): Promise<readonly unknown[]>;
  recordDecision(input: ReviewDecisionInput): Promise<void>;
}
