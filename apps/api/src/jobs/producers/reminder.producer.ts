/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { JobRepository } from "../job.repository.js";
import { createReminderDeliveryJobKey } from "../job-keys.js";

export interface DeliverReminderJobPayload {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}

export class ReminderProducer {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {JobRepository} jobs - Input value for jobs.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly jobs: JobRepository) {}

  /**
   * @description Implements the enqueue method for this service or adapter.
   * @param {DeliverReminderJobPayload} input - Input value for input.
   * @param {Date} runAt - Input value for run at.
   * @returns {Promise<void>} Result of the enqueue operation.
   */
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
