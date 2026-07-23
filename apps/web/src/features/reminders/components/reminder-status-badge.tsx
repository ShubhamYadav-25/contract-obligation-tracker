import { Badge } from "../../../components/ui/badge.js";

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

export function ReminderStatusBadge({ status }: { readonly status: ReminderStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
