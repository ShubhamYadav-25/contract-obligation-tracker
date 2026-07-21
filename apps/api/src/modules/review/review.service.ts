import type { ReviewRepository } from "./review.repository.js";
import type { ReviewDecisionInput } from "./review.types.js";

export class ReviewService {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  listPendingCandidates(): Promise<readonly unknown[]> {
    return this.reviewRepository.listPendingCandidates();
  }

  recordDecision(input: ReviewDecisionInput): Promise<void> {
    return this.reviewRepository.recordDecision(input);
  }
}
