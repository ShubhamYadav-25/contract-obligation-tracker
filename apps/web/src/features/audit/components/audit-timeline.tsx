import { formatDateTime } from "../../../utils/format-date.js";

export interface AuditTimelineItem {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly timestamp: string;
  readonly previousValues?: Record<string, unknown>;
  readonly newValues?: Record<string, unknown>;
  readonly correlationId?: string;
}

export function AuditTimeline({ items }: { readonly items: readonly AuditTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No audit events are available.</p>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li className="rounded-md border border-border bg-white p-4 text-sm" key={item.id}>
          <p className="font-semibold">{item.action}</p>
          <p className="text-muted">
            {item.actor} at {formatDateTime(item.timestamp)}
          </p>
          {item.correlationId ? (
            <p className="mt-1 font-mono text-xs text-muted">{item.correlationId}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
