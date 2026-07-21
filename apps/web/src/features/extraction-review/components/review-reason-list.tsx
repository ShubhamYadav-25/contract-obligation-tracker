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
