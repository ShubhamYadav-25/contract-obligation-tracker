/**
 * @file Defines reusable feedback components for loading, empty, retry, or error states.
 */
import { ApiError } from "@/services/api-error.js";

/**
 * @description Renders the inline error component for the contract tracker UI.
 * @param {{ readonly error: unknown }} { error } - Input value for { error }.
 * @returns {JSX.Element} Result of the inline error operation.
 */
export function InlineError({ error }: { readonly error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  const detail =
    error instanceof ApiError && error.correlationId
      ? `Correlation ID: ${error.correlationId}`
      : undefined;

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      role="alert"
    >
      <p className="font-semibold">{message}</p>
      {detail ? <p className="mt-1">{detail}</p> : null}
    </div>
  );
}
