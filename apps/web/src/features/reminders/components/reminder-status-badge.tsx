/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Badge } from "@/components/ui/badge.js";

export type ReminderStatus =
  "PENDING" | "ENQUEUED" | "PROCESSING" | "DELIVERED" | "RETRY_PENDING" | "FAILED" | "CANCELLED";

const tones: Record<ReminderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "info",
  ENQUEUED: "warning",
  PROCESSING: "warning",
  DELIVERED: "success",
  RETRY_PENDING: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
};

/**
 * @description Renders the reminder status badge component for the contract tracker UI.
 * @param {{ readonly status: ReminderStatus }} { status } - Input value for { status }.
 * @returns {JSX.Element} Result of the reminder status badge operation.
 */
export function ReminderStatusBadge({ status }: { readonly status: ReminderStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
