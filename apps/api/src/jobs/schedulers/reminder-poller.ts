import type { Clock } from "../../infrastructure/clock/clock.js";
import type { ReminderSchedulerRepository } from "../../modules/reminders/reminders.repository.js";

export class ReminderPoller {
  constructor(
    private readonly reminders: ReminderSchedulerRepository,
    private readonly clock: Clock,
    private readonly lookaheadMinutes: number,
  ) {}

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
