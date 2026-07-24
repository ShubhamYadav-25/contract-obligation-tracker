import type { ObligationStatus } from "@contract-obligation-tracker/shared";

import { Badge } from "@/components/ui/badge.js";

const toneByStatus: Record<
  ObligationStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  UPCOMING: "info",
  DUE: "warning",
  MET: "success",
  MISSED: "danger",
};

export function ObligationStatusBadge({ status }: { readonly status: ObligationStatus }) {
  return <Badge tone={toneByStatus[status]}>{status}</Badge>;
}
