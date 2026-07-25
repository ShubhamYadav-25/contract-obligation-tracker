/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
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

/**
 * @description Performs the can transition contract helper operation for this module.
 * @param {ContractProcessingRunStatus} from - Input value for from.
 * @param {ContractProcessingRunStatus} to - Input value for to.
 * @returns {boolean} Result of the can transition contract operation.
 */
export function canTransitionContract(
  from: ContractProcessingRunStatus,
  to: ContractProcessingRunStatus,
): boolean {
  return allowedContractTransitions.get(from)?.includes(to) ?? false;
}

/**
 * @description Performs the assert contract processing transition helper operation for this module.
 * @param {ContractProcessingRunStatus} from - Input value for from.
 * @param {ContractProcessingRunStatus} to - Input value for to.
 * @returns {void} Result of the assert contract processing transition operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function assertContractProcessingTransition(
  from: ContractProcessingRunStatus,
  to: ContractProcessingRunStatus,
): void {
  if (!canTransitionContract(from, to)) {
    throw new Error(`Invalid contract processing transition: ${from} -> ${to}`);
  }
}
