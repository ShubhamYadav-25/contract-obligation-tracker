export const obligationStatuses = ["UPCOMING", "DUE", "MET", "MISSED"] as const;

export type ObligationStatus = (typeof obligationStatuses)[number];

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
    throw new Error(`Invalid obligation transition: ${from} -> ${to}`);
  }
}
