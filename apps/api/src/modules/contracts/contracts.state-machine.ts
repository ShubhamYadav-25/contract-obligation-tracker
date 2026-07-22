import type { ContractProcessingRunStatus } from "./contracts.types.js";

const allowedContractTransitions: ReadonlyMap<
  ContractProcessingRunStatus,
  readonly ContractProcessingRunStatus[]
> = new Map([
  ["RECEIVED", ["STORED", "FAILED"]],
  ["STORED", ["QUEUED", "FAILED"]],
  ["QUEUED", ["PROCESSING"]],
  ["PROCESSING", ["PARSING", "QUEUED", "COMPLETED", "REVIEW_REQUIRED", "FAILED"]],
  ["PARSING", ["OCR_PROCESSING", "TEXT_SEGMENTED", "QUEUED", "FAILED"]],
  ["OCR_PROCESSING", ["TEXT_SEGMENTED", "QUEUED", "FAILED"]],
  ["TEXT_SEGMENTED", ["COMPLETED", "REVIEW_REQUIRED", "FAILED"]],
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
