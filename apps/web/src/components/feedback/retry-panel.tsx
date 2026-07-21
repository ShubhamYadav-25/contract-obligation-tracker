import { RotateCcw } from "lucide-react";

import { Button } from "../ui/button.js";
import { InlineError } from "./inline-error.js";

export function RetryPanel({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <InlineError error={error} />
      <Button onClick={onRetry} type="button" variant="secondary">
        <RotateCcw aria-hidden size={16} />
        Retry
      </Button>
    </div>
  );
}
