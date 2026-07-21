import type { Clock } from "../../infrastructure/clock/clock.js";
import { createReminderOccurrenceKey } from "./reminder-occurrence-key.js";
import type { ReminderRepository } from "./reminders.repository.js";

export class ReminderService {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  async schedule(input: { readonly obligationId: string; readonly scheduledFor: Date }) {
    const occurrenceKey = createReminderOccurrenceKey(input);
    return this.reminders.createScheduled({ ...input, occurrenceKey });
  }

  claimDue(limit: number) {
    const now = this.clock.now();
    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
    return this.reminders.claimDue({ now, leaseUntil, limit });
  }
}
