type ContractProcessingStatus =
  "UPLOADED" | "QUEUED" | "PROCESSING" | "REVIEW_REQUIRED" | "ACTIVE" | "FAILED";

const allowedContractTransitions: ReadonlyMap<
  ContractProcessingStatus,
  readonly ContractProcessingStatus[]
> = new Map([
  ["UPLOADED", ["QUEUED"]],
  ["QUEUED", ["PROCESSING"]],
  ["PROCESSING", ["REVIEW_REQUIRED", "ACTIVE", "FAILED"]],
  ["REVIEW_REQUIRED", ["ACTIVE", "FAILED"]],
  ["ACTIVE", []],
  ["FAILED", ["QUEUED"]],
]);

export function canTransitionContract(
  from: ContractProcessingStatus,
  to: ContractProcessingStatus,
): boolean {
  return allowedContractTransitions.get(from)?.includes(to) ?? false;
}
