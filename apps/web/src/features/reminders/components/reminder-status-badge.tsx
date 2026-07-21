import { Badge } from "../../../components/ui/badge.js";

export type ReminderStatus = "SCHEDULED" | "CLAIMED" | "DELIVERED" | "FAILED" | "CANCELLED";

const tones: Record<ReminderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  SCHEDULED: "info",
  CLAIMED: "warning",
  DELIVERED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function ReminderStatusBadge({ status }: { readonly status: ReminderStatus }) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
