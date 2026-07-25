/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { ReminderRepository } from "../../modules/reminders/reminders.repository.js";

export class RecoverExpiredReminders {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ReminderRepository} reminders - Input value for reminders.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly reminders: ReminderRepository) {}

  /**
   * @description Implements the recover method for this service or adapter.
   * @param {Date} now - Input value for now.
   * @returns {Promise<number>} Result of the recover operation.
   */
  recover(now: Date): Promise<number> {
    return this.reminders.recoverExpiredLeases(now);
  }
}
