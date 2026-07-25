/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
/**
 * @description Executes the create reminder occurrence key operation used by the application workflow.
 * @param {{ readonly obligationId: string; readonly scheduledFor: Date; }} input - Input value for input.
 * @returns {string} Result of the create reminder occurrence key operation.
 */
export function createReminderOccurrenceKey(input: {
  readonly obligationId: string;
  readonly scheduledFor: Date;
}): string {
  return `obligation:${input.obligationId}:scheduled:${input.scheduledFor.toISOString()}`;
}
