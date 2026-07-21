import { Badge } from "../../../components/ui/badge.js";
import type { ContractProcessingStatus } from "../types/contracts.js";

const toneByStatus: Record<
  ContractProcessingStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  UPLOADED: "neutral",
  QUEUED: "info",
  PROCESSING: "info",
  REVIEW_REQUIRED: "warning",
  ACTIVE: "success",
  FAILED: "danger",
};

export function ContractStatusBadge({ status }: { readonly status: ContractProcessingStatus }) {
  return <Badge tone={toneByStatus[status]}>{status.replace("_", " ")}</Badge>;
}
