export interface MessageSummary {
  readonly id: string;
  readonly reminderId: string;
  readonly obligationId: string;
  readonly contractId: string;
  readonly contractDisplayName: string;
  readonly obligationTitle: string;
  readonly reminderStatus: string;
  readonly scheduledFor: string;
  readonly payload: unknown;
  readonly createdAt: string;
}
