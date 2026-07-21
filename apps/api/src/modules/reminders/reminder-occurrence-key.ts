export function createReminderOccurrenceKey(input: {
  readonly obligationId: string;
  readonly scheduledFor: Date;
}): string {
  return `obligation:${input.obligationId}:scheduled:${input.scheduledFor.toISOString()}`;
}
