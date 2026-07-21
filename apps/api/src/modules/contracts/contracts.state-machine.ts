import type { ContractProcessingRunStatus } from "./contracts.types.js";

const allowedContractTransitions: ReadonlyMap<
  ContractProcessingRunStatus,
  readonly ContractProcessingRunStatus[]
> = new Map([
  ["RECEIVED", ["STORED", "FAILED"]],
  ["STORED", ["QUEUED", "FAILED"]],
  ["QUEUED", ["PROCESSING"]],
  ["PROCESSING", ["QUEUED", "COMPLETED", "REVIEW_REQUIRED", "FAILED"]],
  ["COMPLETED", []],
  ["REVIEW_REQUIRED", []],
  ["FAILED", ["QUEUED"]],
]);

export function canTransitionContract(
  from: ContractProcessingRunStatus,
  to: ContractProcessingRunStatus,
): boolean {
  return allowedContractTransitions.get(from)?.includes(to) ?? false;
}

export function assertContractProcessingTransition(
  from: ContractProcessingRunStatus,
  to: ContractProcessingRunStatus,
): void {
  if (!canTransitionContract(from, to)) {
    throw new Error(`Invalid contract processing transition: ${from} -> ${to}`);
  }
}
