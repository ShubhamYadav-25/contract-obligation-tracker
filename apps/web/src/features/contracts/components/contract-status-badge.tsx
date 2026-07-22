import { Badge } from "../../../components/ui/badge.js";
import type { ContractProcessingStatus } from "../types/contracts.js";

const toneByStatus: Record<
  ContractProcessingStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  RECEIVED: "neutral",
  STORED: "success",
  QUEUED: "warning",
  PROCESSING: "info",
  PARSING: "info",
  OCR_PROCESSING: "info",
  TEXT_SEGMENTED: "success",
  COMPLETED: "success",
  REVIEW_REQUIRED: "warning",
  FAILED: "danger",
};

export function ContractStatusBadge({ status }: { readonly status: ContractProcessingStatus }) {
  return <Badge tone={toneByStatus[status]}>{status.replace("_", " ")}</Badge>;
}
