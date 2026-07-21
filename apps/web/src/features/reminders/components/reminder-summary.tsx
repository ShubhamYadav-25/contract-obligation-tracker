import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { formatDateTime } from "../../../utils/format-date.js";
import { ReminderStatusBadge } from "./reminder-status-badge.js";
import type { ReminderStatus } from "./reminder-status-badge.js";

export interface ReminderSummaryItem {
  readonly id: string;
  readonly status: ReminderStatus;
  readonly scheduledFor: string;
  readonly attemptCount: number;
  readonly deliveryAttempts: number;
}

export function ReminderSummary({ reminder }: { readonly reminder: ReminderSummaryItem }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <ReminderStatusBadge status={reminder.status} />
        <Button disabled={reminder.status !== "FAILED"} type="button" variant="secondary">
          <RotateCcw aria-hidden size={16} />
          Retry
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted">Scheduled</dt>
          <dd>{formatDateTime(reminder.scheduledFor)}</dd>
        </div>
        <div>
          <dt className="text-muted">Attempts</dt>
          <dd>{reminder.attemptCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Deliveries</dt>
          <dd>{reminder.deliveryAttempts}</dd>
        </div>
      </dl>
    </div>
  );
}
