/**
 * @file Defines shared package exports and cross-app domain utilities.
 */
export const obligationStatuses = ["UPCOMING", "DUE", "MET", "MISSED"] as const;

export type ObligationStatus = (typeof obligationStatuses)[number];

const allowedTransitions: ReadonlyMap<ObligationStatus, readonly ObligationStatus[]> = new Map([
  ["UPCOMING", ["DUE"]],
  ["DUE", ["MET", "MISSED"]],
  ["MET", []],
  ["MISSED", []],
]);

/**
 * @description Executes the get allowed obligation transitions operation used by the application workflow.
 * @param {ObligationStatus} from - Input value for from.
 * @returns {readonly ObligationStatus[]} Result of the get allowed obligation transitions operation.
 */
export function getAllowedObligationTransitions(
  from: ObligationStatus,
): readonly ObligationStatus[] {
  return allowedTransitions.get(from) ?? [];
}

/**
 * @description Performs the can transition obligation helper operation for this module.
 * @param {ObligationStatus} from - Input value for from.
 * @param {ObligationStatus} to - Input value for to.
 * @returns {boolean} Result of the can transition obligation operation.
 */
export function canTransitionObligation(from: ObligationStatus, to: ObligationStatus): boolean {
  return getAllowedObligationTransitions(from).includes(to);
}

/**
 * @description Performs the assert obligation transition helper operation for this module.
 * @param {ObligationStatus} from - Input value for from.
 * @param {ObligationStatus} to - Input value for to.
 * @returns {void} Result of the assert obligation transition operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function assertObligationTransition(from: ObligationStatus, to: ObligationStatus): void {
  if (!canTransitionObligation(from, to)) {
    throw new Error(`Invalid obligation transition: ${from} -> ${to}`);
  }
}
