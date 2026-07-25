/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
/**
 * @description Executes the create contract storage key operation used by the application workflow.
 * @param {{ readonly organizationId: string; readonly contractId: string; readonly documentId: string; }} input - Input value for input.
 * @returns {string} Result of the create contract storage key operation.
 */
export function createContractStorageKey(input: {
  readonly organizationId: string;
  readonly contractId: string;
  readonly documentId: string;
}): string {
  return [
    "organizations",
    input.organizationId,
    "contracts",
    input.contractId,
    "documents",
    input.documentId,
    "original.pdf",
  ].join("/");
}
