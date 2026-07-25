/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Badge } from "@/components/ui/badge.js";
import type { KpiStatus } from "../types/kpi.js";

const tones: Record<KpiStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PASS: "success",
  WARN: "warning",
  FAIL: "danger",
  NOT_MEASURED: "neutral",
};

/**
 * @description Renders the kpi status badge component for the contract tracker UI.
 * @param {{ readonly status: KpiStatus }} { status } - Input value for { status }.
 * @returns {JSX.Element} Result of the kpi status badge operation.
 */
export function KpiStatusBadge({ status }: { readonly status: KpiStatus }) {
  return <Badge tone={tones[status]}>{status.replace("_", " ")}</Badge>;
}
