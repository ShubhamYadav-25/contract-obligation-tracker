import { RotateCcw } from "lucide-react";
import { useParams } from "react-router-dom";

import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { Button } from "../../../components/ui/button.js";
import { Card } from "../../../components/ui/card.js";
import { formatDateTime } from "../../../utils/format-date.js";
import { ContractKeyFields } from "../components/contract-key-fields.js";
import { ContractStatusBadge } from "../components/contract-status-badge.js";
import { useContract } from "../hooks/use-contract.js";

export function ContractDetailPage() {
  const contractId = useParams().contractId ?? "";
  const contract = useContract(contractId);

  return (
    <ContentContainer>
      <PageHeader
        description="Review processing state, key fields, candidates, obligations, and failures."
        title="Contract detail"
      />
      {contract.isLoading ? <LoadingState /> : null}
      {contract.isError ? (
        <RetryPanel error={contract.error} onRetry={() => void contract.refetch()} />
      ) : null}
      {contract.isSuccess ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{contract.data.fileName}</h2>
                <p className="mt-1 text-sm text-muted">
                  Uploaded {formatDateTime(contract.data.uploadedAt)}
                </p>
              </div>
              <ContractStatusBadge status={contract.data.status} />
            </div>
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold">Key fields</h3>
              <ContractKeyFields fields={contract.data.keyFields} />
            </div>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Processing</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">SHA-256</dt>
                <dd className="break-all font-mono text-xs">{contract.data.sha256}</dd>
              </div>
              <div>
                <dt className="text-muted">Candidates</dt>
                <dd>{contract.data.candidateCount}</dd>
              </div>
              <div>
                <dt className="text-muted">Approved obligations</dt>
                <dd>{contract.data.obligationCount}</dd>
              </div>
            </dl>
            {contract.data.processingErrors.length > 0 ? (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
                {contract.data.processingErrors.join(", ")}
              </div>
            ) : null}
            <Button className="mt-4 w-full" type="button" variant="secondary">
              <RotateCcw aria-hidden size={16} />
              Retry processing
            </Button>
          </Card>
        </div>
      ) : null}
    </ContentContainer>
  );
}
