/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import type { Clock } from "../../infrastructure/clock/clock.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { assertObligationTransition } from "./obligation.state-machine.js";
import type { ObligationRepository } from "./obligations.repository.js";
import type { ObligationTransitionHistoryRepository } from "./transition-history.repository.js";
import type { ObligationRecord, ObligationTransitionInput } from "./obligations.types.js";

export class ObligationService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ObligationRepository} obligations - Input value for obligations.
   * @param {ObligationTransitionHistoryRepository} transitionHistory - Input value for transition history.
   * @param {Clock} clock - Input value for clock.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly transitionHistory: ObligationTransitionHistoryRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * @description Implements the transition method for this service or adapter.
   * @param {ObligationTransitionInput} input - Input value for input.
   * @returns {Promise<ObligationRecord>} Result of the transition operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async transition(input: ObligationTransitionInput): Promise<ObligationRecord> {
    const obligation = await this.obligations.findById(input.obligationId);
    if (!obligation) {
      throw new NotFoundError("Obligation was not found", { obligationId: input.obligationId });
    }

    assertObligationTransition(input.fromStatus, input.toStatus);

    const updated = await this.obligations.updateStatus({
      id: input.obligationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      expectedVersion: input.expectedVersion,
    });

    await this.transitionHistory.record({
      obligationId: input.obligationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      occurredAt: this.clock.now(),
    });

    return updated;
  }
}
