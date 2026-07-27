/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { FileText, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { Button } from "@/components/ui/button.js";
import { Card } from "@/components/ui/card.js";
import { cx } from "@/utils/cx.js";
import { formatDateTime } from "@/utils/format-date.js";
import { useReprocessContract } from "../hooks/use-reprocess-contract.js";
import { ContractStatusBadge } from "./contract-status-badge.js";
import type { ContractSummary } from "../types/contracts.js";

/**
 * @description Renders the contract card component for the contract tracker UI.
 * @param {{ readonly contract: ContractSummary }} { contract } - Input value for { contract }.
 * @returns {JSX.Element} Result of the contract card operation.
 */
export function ContractCard({ contract }: { readonly contract: ContractSummary }) {
  const status = contract.processing?.status ?? "RECEIVED";
  const uploadedAt = contract.currentDocument?.uploadedAt ?? contract.createdAt;
  const reprocessMutation = useReprocessContract();

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="flex items-center gap-2 text-base font-semibold text-ink hover:text-teal-800"
            to={routePaths.contractDetail(contract.id)}
          >
            <FileText aria-hidden size={18} />
            <span className="truncate">{contract.displayName}</span>
          </Link>
          <p className="mt-1 text-sm text-muted">Uploaded {formatDateTime(uploadedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ContractStatusBadge status={status} />
          {status === "FAILED" ? (
            <Button
              variant="secondary"
              className="h-8 px-2 text-xs"
              disabled={reprocessMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                reprocessMutation.mutate(contract.id);
              }}
              title="Reprocess Contract"
            >
              <RotateCw className={cx("h-3 w-3", reprocessMutation.isPending && "animate-spin")} />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Pages</dt>
          <dd className="font-semibold">{contract.text.pageCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Segments</dt>
          <dd className="font-semibold">{contract.text.segmentCount}</dd>
        </div>
      </dl>
    </Card>
  );
}
