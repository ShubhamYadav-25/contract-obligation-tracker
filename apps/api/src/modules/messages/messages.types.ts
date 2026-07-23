export interface MessageRecord {
  readonly id: string;
  readonly reminderId: string;
  readonly obligationId: string;
  readonly contractId: string;
  readonly contractDisplayName: string;
  readonly obligationTitle: string;
  readonly reminderStatus: string;
  readonly scheduledFor: Date;
  readonly payload: unknown;
  readonly createdAt: Date;
}
