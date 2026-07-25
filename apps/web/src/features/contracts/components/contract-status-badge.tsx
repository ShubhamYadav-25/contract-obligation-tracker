/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Badge } from "@/components/ui/badge.js";
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

/**
 * @description Renders the contract status badge component for the contract tracker UI.
 * @param {{ readonly status: ContractProcessingStatus }} { status } - Input value for { status }.
 * @returns {JSX.Element} Result of the contract status badge operation.
 */
export function ContractStatusBadge({ status }: { readonly status: ContractProcessingStatus }) {
  return <Badge tone={toneByStatus[status]}>{status.replace("_", " ")}</Badge>;
}
