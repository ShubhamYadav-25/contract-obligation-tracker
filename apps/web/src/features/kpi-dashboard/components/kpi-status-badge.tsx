import { Badge } from "../../../components/ui/badge.js";
import type { KpiStatus } from "../types/kpi.js";

const tones: Record<KpiStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PASS: "success",
  WARN: "warning",
  FAIL: "danger",
  NOT_MEASURED: "neutral",
};

export function KpiStatusBadge({ status }: { readonly status: KpiStatus }) {
  return <Badge tone={tones[status]}>{status.replace("_", " ")}</Badge>;
}
