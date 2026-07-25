/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type { Clock } from "../../infrastructure/clock/clock.js";
import { createReminderOccurrenceKey } from "./reminder-occurrence-key.js";
import type { ReminderRepository } from "./reminders.repository.js";

export class ReminderService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReminderRepository} reminders - Input value for reminders.
   * @param {Clock} clock - Input value for clock.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * @description Implements the schedule method for this service or adapter.
   * @param {{ readonly obligationId: string; readonly scheduledFor: Date }} input - Input value for input.
   * @returns {Promise<unknown>} Result of the schedule operation.
   */
  async schedule(input: { readonly obligationId: string; readonly scheduledFor: Date }) {
    const occurrenceKey = createReminderOccurrenceKey(input);
    return this.reminders.createScheduled({ ...input, occurrenceKey });
  }

  /**
   * @description Implements the claim due method for this service or adapter.
   * @param {number} limit - Input value for limit.
   * @returns {unknown} Result of the claim due operation.
   */
  claimDue(limit: number) {
    const now = this.clock.now();
    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
    return this.reminders.claimDue({ now, leaseUntil, limit });
  }
}
