export function createContractProcessingJobKey(input: { readonly documentId: string }): string {
  return `contract-processing:${input.documentId}`;
}

export function createReminderDeliveryJobKey(reminderId: string): string {
  return `reminder:${reminderId}:delivery`;
}
