import { InvalidTransitionError } from "../../shared/errors/invalid-transition-error.js";
import type { ObligationStatus } from "./obligations.types.js";

const allowedTransitions: ReadonlyMap<ObligationStatus, readonly ObligationStatus[]> = new Map([
  ["UPCOMING", ["DUE"]],
  ["DUE", ["MET", "MISSED"]],
  ["MET", []],
  ["MISSED", []],
]);

export function getAllowedObligationTransitions(
  from: ObligationStatus,
): readonly ObligationStatus[] {
  return allowedTransitions.get(from) ?? [];
}

export function canTransitionObligation(from: ObligationStatus, to: ObligationStatus): boolean {
  return getAllowedObligationTransitions(from).includes(to);
}

export function assertObligationTransition(from: ObligationStatus, to: ObligationStatus): void {
  if (!canTransitionObligation(from, to)) {
    throw new InvalidTransitionError("Transition is not allowed", { from, to });
  }
}
