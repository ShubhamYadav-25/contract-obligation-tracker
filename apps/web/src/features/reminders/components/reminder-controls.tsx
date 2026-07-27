import { useState } from "react";
import { CalendarPlus, PauseCircle, PlayCircle, RotateCcw, Save } from "lucide-react";

import { InlineError } from "@/components/feedback/inline-error.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { formatDateTime } from "@/utils/format-date.js";
import { useReminderMutations, useReminders } from "../hooks/use-reminders.js";
import { ReminderStatusBadge } from "./reminder-status-badge.js";

function toLocalInput(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ReminderControls({
  obligationId,
  dueAt,
}: {
  readonly obligationId: string;
  readonly dueAt?: string | undefined;
}) {
  const reminders = useReminders(obligationId);
  const mutations = useReminderMutations(obligationId);
  const suggested = dueAt
    ? new Date(new Date(dueAt).getTime() - 3 * 24 * 60 * 60_000)
    : new Date(Date.now() + 24 * 60 * 60_000);
  const [newSchedule, setNewSchedule] = useState(() => toLocalInput(suggested));
  const [editedSchedules, setEditedSchedules] = useState<Record<string, string>>({});
  const pending =
    mutations.create.isPending || mutations.reschedule.isPending || mutations.transition.isPending;
  const error = mutations.create.error ?? mutations.reschedule.error ?? mutations.transition.error;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Reminder controls</h2>
        <p className="mt-1 text-xs text-muted">
          Scheduling and state changes are validated by the server with optimistic version checks.
        </p>
      </div>
      {reminders.isError ? <InlineError error={reminders.error} /> : null}
      {error ? <InlineError error={error} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="New reminder schedule"
          min={toLocalInput(new Date())}
          onChange={(event) => setNewSchedule(event.target.value)}
          type="datetime-local"
          value={newSchedule}
        />
        <Button
          disabled={pending || !newSchedule}
          onClick={() =>
            mutations.create.mutate({
              obligationId,
              scheduledFor: new Date(newSchedule).toISOString(),
            })
          }
          type="button"
        >
          <CalendarPlus size={16} />
          Schedule
        </Button>
      </div>
      {reminders.isSuccess && reminders.data.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted">
          No reminders exist. Add one to exercise the pending and delivery workflow.
        </p>
      ) : null}
      {reminders.data?.map((reminder) => {
        const editable = ["PENDING", "RETRY_PENDING", "FAILED", "CANCELLED"].includes(
          reminder.status,
        );
        const schedule = editedSchedules[reminder.id] ?? toLocalInput(reminder.scheduledFor);
        return (
          <article className="rounded-lg border border-slate-200 p-3" key={reminder.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ReminderStatusBadge status={reminder.status} />
              <span className="text-xs text-muted">
                Version {reminder.version} · {reminder.retryCount} attempts
              </span>
            </div>
            <p className="mt-2 text-sm">Scheduled {formatDateTime(reminder.scheduledFor)}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Input
                aria-label={`Schedule for reminder ${reminder.id}`}
                disabled={!editable || pending}
                onChange={(event) =>
                  setEditedSchedules((current) => ({
                    ...current,
                    [reminder.id]: event.target.value,
                  }))
                }
                type="datetime-local"
                value={schedule}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!editable || pending || schedule === toLocalInput(reminder.scheduledFor)}
                  onClick={() =>
                    mutations.reschedule.mutate({
                      reminderId: reminder.id,
                      scheduledFor: new Date(schedule).toISOString(),
                      expectedVersion: reminder.version,
                    })
                  }
                  type="button"
                  variant="secondary"
                >
                  <Save size={15} />
                  Reschedule
                </Button>
                {["PENDING", "ENQUEUED", "RETRY_PENDING", "FAILED"].includes(reminder.status) ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      mutations.transition.mutate({
                        reminderId: reminder.id,
                        action: "CANCEL",
                        expectedVersion: reminder.version,
                      })
                    }
                    type="button"
                    variant="secondary"
                  >
                    <PauseCircle size={15} />
                    Cancel
                  </Button>
                ) : null}
                {reminder.status === "CANCELLED" ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      mutations.transition.mutate({
                        reminderId: reminder.id,
                        action: "ACTIVATE",
                        expectedVersion: reminder.version,
                      })
                    }
                    type="button"
                  >
                    <PlayCircle size={15} />
                    Activate
                  </Button>
                ) : null}
                {reminder.status === "FAILED" ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      mutations.transition.mutate({
                        reminderId: reminder.id,
                        action: "RETRY",
                        expectedVersion: reminder.version,
                      })
                    }
                    type="button"
                  >
                    <RotateCcw size={15} />
                    Retry
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
