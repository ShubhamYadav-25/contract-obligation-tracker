export type ReminderStatus =
  | "PENDING"
  | "ENQUEUED"
  | "PROCESSING"
  | "DELIVERED"
  | "RETRY_PENDING"
  | "FAILED"
  | "CANCELLED";

export interface Reminder {
  readonly id: string;
  readonly obligationId: string;
  readonly contractId: string | null;
  readonly obligationTitle: string | null;
  readonly scheduledFor: string;
  readonly occurrenceKey: string;
  readonly status: ReminderStatus;
  readonly retryCount: number;
  readonly leaseExpiresAt: string | null;
  readonly version: number;
}
