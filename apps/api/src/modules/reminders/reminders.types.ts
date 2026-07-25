/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
export type ReminderStatus =
  "PENDING" | "ENQUEUED" | "PROCESSING" | "DELIVERED" | "RETRY_PENDING" | "FAILED" | "CANCELLED";

export interface ReminderRecord {
  readonly id: string;
  readonly obligationId: string;
  readonly contractId?: string;
  readonly obligationTitle?: string;
  readonly scheduledFor: Date;
  readonly occurrenceKey: string;
  readonly status: ReminderStatus;
  readonly retryCount: number;
  readonly leaseExpiresAt?: Date;
  readonly version: number;
}

export interface ReminderSchedulingPolicy {
  readonly offsetsBeforeDueMinutes: readonly number[];
}

export type ReminderDeliveryAttemptStatus = "STARTED" | "DELIVERED" | "FAILED" | "UNKNOWN";

export interface ReminderDeliveryAttempt {
  readonly id: string;
  readonly reminderId: string;
  readonly attemptNumber: number;
  readonly provider: string;
  readonly status: ReminderDeliveryAttemptStatus;
  readonly providerMessageId?: string | undefined;
  readonly errorCode?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly startedAt: Date;
  readonly completedAt?: Date | undefined;
}
