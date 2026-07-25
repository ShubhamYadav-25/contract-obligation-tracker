/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { formatDateTime } from "@/utils/format-date.js";
import type { ObligationTransition } from "../types/obligation.js";

/**
 * @description Renders the transition history component for the contract tracker UI.
 * @param {{ readonly transitions: readonly ObligationTransition[]; }} { transitions, } - Input value for { transitions, }.
 * @returns {JSX.Element} Result of the transition history operation.
 */
export function TransitionHistory({
  transitions,
}: {
  readonly transitions: readonly ObligationTransition[];
}) {
  if (transitions.length === 0) {
    return <p className="text-sm text-muted">No transitions have been recorded.</p>;
  }

  return (
    <ol className="space-y-3">
      {transitions.map((transition) => (
        <li
          className="rounded-md border border-border bg-white p-3 text-sm"
          key={`${transition.fromStatus}-${transition.occurredAt}`}
        >
          <p className="font-medium">
            {transition.fromStatus} to {transition.toStatus}
          </p>
          <p className="text-muted">
            {transition.actor} at {formatDateTime(transition.occurredAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
