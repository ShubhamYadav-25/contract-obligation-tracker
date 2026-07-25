/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
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

/**
 * @description Renders the obligation status badge component for the contract tracker UI.
 * @param {{ readonly status: ObligationStatus }} { status } - Input value for { status }.
 * @returns {JSX.Element} Result of the obligation status badge operation.
 */
export function ObligationStatusBadge({ status }: { readonly status: ObligationStatus }) {
  return <Badge tone={toneByStatus[status]}>{status}</Badge>;
}
