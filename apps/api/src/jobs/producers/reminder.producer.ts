import type { JobRepository } from "../job.repository.js";
import { createReminderDeliveryJobKey } from "../job-keys.js";

export interface DeliverReminderJobPayload {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}

export class ReminderProducer {
  constructor(private readonly jobs: JobRepository) {}

  enqueue(input: DeliverReminderJobPayload, runAt?: Date): Promise<void> {
    return this.jobs
      .createJob({
        jobType: "DELIVER_REMINDER",
        idempotencyKey: createReminderDeliveryJobKey(input.reminderId),
        payload: input,
        ...(runAt ? { availableAt: runAt } : {}),
      })
      .then(() => undefined);
  }
}
