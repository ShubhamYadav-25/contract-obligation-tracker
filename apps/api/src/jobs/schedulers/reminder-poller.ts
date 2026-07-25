/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { Clock } from "../../infrastructure/clock/clock.js";
import type { ReminderSchedulerRepository } from "../../modules/reminders/reminders.repository.js";

export class ReminderPoller {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReminderSchedulerRepository} reminders - Input value for reminders.
   * @param {Clock} clock - Input value for clock.
   * @param {number} lookaheadMinutes - Input value for lookahead minutes.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly reminders: ReminderSchedulerRepository,
    private readonly clock: Clock,
    private readonly lookaheadMinutes: number,
  ) {}

  /**
   * @description Implements the poll due reminders method for this service or adapter.
   * @param {number} limit - Input value for limit.
   * @returns {Promise<number>} Result of the poll due reminders operation.
   */
  async pollDueReminders(limit: number): Promise<number> {
    const now = this.clock.now();
    const result = await this.reminders.enqueueDueReminders({
      now,
      lookaheadUntil: new Date(now.getTime() + this.lookaheadMinutes * 60_000),
      limit,
    });

    return result.remindersClaimed;
  }
}
