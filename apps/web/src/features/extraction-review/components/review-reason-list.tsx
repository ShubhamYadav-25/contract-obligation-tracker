/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
/**
 * @description Renders the review reason list component for the contract tracker UI.
 * @param {{ readonly reasons: readonly string[] }} { reasons } - Input value for { reasons }.
 * @returns {JSX.Element} Result of the review reason list operation.
 */
export function ReviewReasonList({ reasons }: { readonly reasons: readonly string[] }) {
  if (reasons.length === 0) {
    return <p className="text-sm text-muted">No validation reasons were reported.</p>;
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}
