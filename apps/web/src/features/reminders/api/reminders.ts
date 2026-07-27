import { z } from "zod";

import { apiRequest } from "@/services/api-client.js";
import type { Reminder, ReminderStatus } from "../types/reminder.js";

export const reminderSchema = z.object({
  id: z.string(),
  obligationId: z.string(),
  contractId: z.string().nullable(),
  obligationTitle: z.string().nullable(),
  scheduledFor: z.string(),
  occurrenceKey: z.string(),
  status: z.enum([
    "PENDING",
    "ENQUEUED",
    "PROCESSING",
    "DELIVERED",
    "RETRY_PENDING",
    "FAILED",
    "CANCELLED",
  ]),
  retryCount: z.number(),
  leaseExpiresAt: z.string().nullable(),
  version: z.number(),
});

export function listReminders(obligationId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ obligationId, limit: "100", offset: "0" });
  return apiRequest<readonly Reminder[]>(`/api/reminders?${query.toString()}`, {
    signal,
    responseSchema: z.array(reminderSchema),
  });
}

export function createReminder(input: { readonly obligationId: string; readonly scheduledFor: string }) {
  return apiRequest<Reminder>("/api/reminders", {
    method: "POST",
    body: input,
    responseSchema: reminderSchema,
  });
}

export function rescheduleReminder(input: {
  readonly reminderId: string;
  readonly scheduledFor: string;
  readonly expectedVersion: number;
}) {
  const { reminderId, ...body } = input;
  return apiRequest<Reminder>(`/api/reminders/${reminderId}`, {
    method: "PATCH",
    body,
    responseSchema: reminderSchema,
  });
}

export function transitionReminder(input: {
  readonly reminderId: string;
  readonly action: "CANCEL" | "ACTIVATE" | "RETRY";
  readonly expectedVersion: number;
}) {
  const { reminderId, ...body } = input;
  return apiRequest<Reminder>(`/api/reminders/${reminderId}/actions`, {
    method: "POST",
    body,
    responseSchema: reminderSchema,
  });
}

export const editableReminderStatuses: readonly ReminderStatus[] = [
  "PENDING",
  "RETRY_PENDING",
  "FAILED",
  "CANCELLED",
];
