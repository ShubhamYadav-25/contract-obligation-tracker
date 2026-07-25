/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import type { ObligationStatus } from "@contract-obligation-tracker/shared";
import { getAllowedObligationTransitions } from "@contract-obligation-tracker/shared";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button.js";

/**
 * @description Renders the transition dialog component for the contract tracker UI.
 * @param {{ readonly status: ObligationStatus; readonly disabled?: boolean; readonly onSelect: (nextStatus: ObligationStatus) => void; }} { disabled = false, onSelect, status, } - Input value for { disabled = false, on select, status, }.
 * @returns {JSX.Element} Result of the transition dialog operation.
 */
export function TransitionDialog({
  disabled = false,
  onSelect,
  status,
}: {
  readonly status: ObligationStatus;
  readonly disabled?: boolean;
  readonly onSelect: (nextStatus: ObligationStatus) => void;
}) {
  const allowedTransitions = getAllowedObligationTransitions(status);

  if (allowedTransitions.length === 0) {
    return <p className="text-sm text-muted">No transitions are available from {status}.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowedTransitions.map((nextStatus) => (
        <Button
          disabled={disabled}
          key={nextStatus}
          onClick={() => onSelect(nextStatus)}
          type="button"
          variant="secondary"
        >
          <ArrowRight aria-hidden size={16} />
          Mark {nextStatus}
        </Button>
      ))}
    </div>
  );
}
