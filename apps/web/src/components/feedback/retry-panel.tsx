/**
 * @file Defines reusable feedback components for loading, empty, retry, or error states.
 */
import { RotateCcw } from "lucide-react";

import { Button } from "../ui/button.js";
import { InlineError } from "./inline-error.js";

/**
 * @description Renders the retry panel component for the contract tracker UI.
 * @param {{ readonly error: unknown; readonly onRetry: () => void; }} { error, onRetry, } - Input value for { error, on retry, }.
 * @returns {JSX.Element} Result of the retry panel operation.
 */
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
