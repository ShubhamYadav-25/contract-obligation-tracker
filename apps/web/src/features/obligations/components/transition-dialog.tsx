import type { ObligationStatus } from "@contract-obligation-tracker/shared";
import { getAllowedObligationTransitions } from "@contract-obligation-tracker/shared";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button.js";

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
