/**
 * @file Defines backend review module contracts, services, routes, or persistence logic.
 */
import type { ReviewRepository } from "./review.repository.js";
import type { ReviewDecisionInput } from "./review.types.js";

export class ReviewService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReviewRepository} reviewRepository - Input value for review repository.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly reviewRepository: ReviewRepository) {}

  /**
   * @description Executes the list pending candidates operation used by the application workflow.
   * @returns {Promise<readonly unknown[]>} Result of the list pending candidates operation.
   */
  listPendingCandidates(): Promise<readonly unknown[]> {
    return this.reviewRepository.listPendingCandidates();
  }

  /**
   * @description Implements the record decision method for this service or adapter.
   * @param {ReviewDecisionInput} input - Input value for input.
   * @returns {Promise<void>} Result of the record decision operation.
   */
  recordDecision(input: ReviewDecisionInput): Promise<void> {
    return this.reviewRepository.recordDecision(input);
  }
}
