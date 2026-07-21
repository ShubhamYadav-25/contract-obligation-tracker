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
