import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { routePaths } from "../../../app/route-paths.js";
import { Card } from "../../../components/ui/card.js";
import { formatDateTime } from "../../../utils/format-date.js";
import { ContractStatusBadge } from "./contract-status-badge.js";
import type { ContractSummary } from "../types/contracts.js";

export function ContractCard({ contract }: { readonly contract: ContractSummary }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="flex items-center gap-2 text-base font-semibold text-ink hover:text-teal-800"
            to={routePaths.contractDetail(contract.id)}
          >
            <FileText aria-hidden size={18} />
            <span className="truncate">{contract.fileName}</span>
          </Link>
          <p className="mt-1 text-sm text-muted">Uploaded {formatDateTime(contract.uploadedAt)}</p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Candidates</dt>
          <dd className="font-semibold">{contract.candidateCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Obligations</dt>
          <dd className="font-semibold">{contract.obligationCount}</dd>
        </div>
      </dl>
    </Card>
  );
}
