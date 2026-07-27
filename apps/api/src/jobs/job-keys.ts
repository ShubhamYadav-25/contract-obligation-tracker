/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
/**
 * @description Executes the create contract processing job key operation used by the application workflow.
 * @param {{ readonly documentId: string; readonly processingRunId: string }} input - Input value for input.
 * @returns {string} Result of the create contract processing job key operation.
 */
export function createContractProcessingJobKey(input: {
  readonly documentId: string;
  readonly processingRunId: string;
}): string {
  return `contract-processing:${input.documentId}:${input.processingRunId}`;
}

/**
 * @description Executes the create reminder delivery job key operation used by the application workflow.
 * @param {string} reminderId - Input value for reminder id.
 * @returns {string} Result of the create reminder delivery job key operation.
 */
export function createReminderDeliveryJobKey(reminderId: string): string {
  return `reminder:${reminderId}:delivery`;
}
