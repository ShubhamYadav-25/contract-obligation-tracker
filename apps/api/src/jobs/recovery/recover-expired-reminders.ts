import type { ReminderRepository } from "../../modules/reminders/reminders.repository.js";

export class RecoverExpiredReminders {
  constructor(private readonly reminders: ReminderRepository) {}

  recover(now: Date): Promise<number> {
    return this.reminders.recoverExpiredLeases(now);
  }
}
