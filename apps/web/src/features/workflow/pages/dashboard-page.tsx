/**
 * @file Defines the API-backed operations dashboard.
 */
import { useMemo, useState } from "react";
import { Calendar, FileText, RotateCw, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import { useContracts } from "@/features/contracts/hooks/use-contracts.js";
import { useReprocessContract } from "@/features/contracts/hooks/use-reprocess-contract.js";
import type { ContractProcessingStatus } from "@/features/contracts/types/contracts.js";
import { useObligations } from "@/features/obligations/hooks/use-obligations.js";
import { useDashboardOverview } from "../hooks/use-operations.js";
import type { ObligationSummary } from "@/features/obligations/types/obligation.js";
import {
  EmptyState,
  KpiCard,
  SectionCard,
  StatusBadge,
  formatStatusLabel,
  statusTone,
} from "../components.js";
import {
  UploadContractDialog,
  contractToUploadRecord,
  type UploadRecord,
} from "../components/upload-contract-dialog.js";

const activeProcessingStatuses: readonly ContractProcessingStatus[] = [
  "RECEIVED",
  "STORED",
  "QUEUED",
  "PROCESSING",
  "PARSING",
  "OCR_PROCESSING",
  "TEXT_SEGMENTED",
];

function formatDueDate(value: string | undefined): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function DeadlineRow({ obligation }: { readonly obligation: ObligationSummary }) {
  return (
    <Link
      className="block rounded-lg border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/40 focus-visible:shadow-focus"
      to={routePaths.obligationDetail(obligation.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900">{obligation.title}</h3>
          <p className="mt-1 truncate text-xs text-slate-600">
            {obligation.contractDisplayName ?? obligation.contractId}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Calendar aria-hidden size={13} />
            {formatDueDate(obligation.dueAt)}
            {obligation.responsibleParty ? ` · ${obligation.responsibleParty}` : ""}
          </p>
        </div>
        <StatusBadge
          label={formatStatusLabel(obligation.status)}
          tone={statusTone(obligation.status)}
        />
      </div>
    </Link>
  );
}

function VerificationRow({ obligation }: { readonly obligation: ObligationSummary }) {
  return (
    <Link
      className="block rounded-lg border border-amber-200 bg-amber-50/60 p-4 transition hover:border-amber-400 hover:bg-amber-50 focus-visible:shadow-focus"
      to={routePaths.obligationDetail(obligation.id)}
    >
      <StatusBadge label="Verify with PDF" tone="warning" />
      <h3 className="mt-2 text-sm font-bold text-slate-900">{obligation.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Open the mapped source and confirm or edit the extracted obligation.
      </p>
    </Link>
  );
}

function AttentionRow({
  contract,
  retrying,
  onRetry,
}: {
  readonly contract: UploadRecord;
  readonly retrying: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <StatusBadge
          label={formatStatusLabel(contract.status)}
          tone={statusTone(contract.status)}
        />
        <h3 className="mt-2 truncate text-sm font-bold text-slate-900">{contract.displayName}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Processing stopped. Retry the stored document or open it for error details.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button disabled={retrying} onClick={onRetry} type="button" variant="secondary">
          <RotateCw aria-hidden className={retrying ? "animate-spin" : ""} size={15} />
          {retrying ? "Retrying" : "Retry"}
        </Button>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:shadow-focus"
          to={routePaths.contractDetail(contract.contractId)}
        >
          Open
        </Link>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const contracts = useContracts({ limit: 100 });
  const obligations = useObligations(undefined, { limit: 100 });
  const overview = useDashboardOverview();
  const reprocess = useReprocessContract();
  const records = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const attention = records.filter((record) => record.status === "FAILED");
  const verificationNeeded = (obligations.data?.items ?? []).filter(
    (item) => item.reviewStatus === "REVIEW_REQUIRED",
  );
  const deadlines = [...(obligations.data?.items ?? [])]
    .filter((item) => item.status !== "MET" && item.dueAt)
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))
    .slice(0, 5);
  const statusCounts = obligations.data?.statusCounts;
  const loading = overview.isLoading;
  const value = (count: number | undefined) =>
    loading ? "Loading" : count === undefined ? "Unavailable" : String(count);

  function retry(contractId: string): void {
    setRetryingId(contractId);
    reprocess.mutate(contractId, { onSettled: () => setRetryingId(null) });
  }

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)} type="button">
            <Upload aria-hidden size={16} />
            Upload Contract
          </Button>
        }
        description="Live contract processing, PDF verification, and upcoming commitments."
        title="Contract Overview"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard helper={`${overview.data?.kpis.uploadedThisMonth ?? 0} uploaded this month`} label="Total Contracts" tone="info" value={value(overview.data?.kpis.totalContracts)} />
        <KpiCard
          helper="In the processing pipeline"
          label="Processing"
          value={value(overview.data?.kpis.processing)}
        />
        <KpiCard
          helper="Mapped obligations to check against the PDF"
          label="Needs Verification"
          tone="warning"
          value={obligations.isLoading ? "Loading" : String(verificationNeeded.length)}
        />
        <KpiCard
          helper="Upcoming and currently due"
          label="Due Soon"
          tone="warning"
          value={value(overview.data?.kpis.dueSoon)}
        />
        <KpiCard
          helper="Past due commitments"
          label="Missed"
          tone="danger"
          value={value(overview.data?.kpis.missed)}
        />
      </div>

      {contracts.isError ? <div className="mb-5"><InlineError error={contracts.error} /></div> : null}
      {obligations.isError ? <div className="mb-5"><InlineError error={obligations.error} /></div> : null}
      {overview.isError ? <div className="mb-5"><InlineError error={overview.error} /></div> : null}
      {reprocess.isError ? <div className="mb-5"><InlineError error={reprocess.error} /></div> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          action={<Link className="text-sm font-semibold text-teal-700 hover:text-teal-900" to={routePaths.contracts}>View all</Link>}
          title="Attention Required"
        >
          {attention.length || verificationNeeded.length ? (
            <div className="space-y-3">
              {attention.slice(0, 5).map((contract) => (
                <AttentionRow
                  contract={contract}
                  key={contract.contractId}
                  onRetry={() => retry(contract.contractId)}
                  retrying={retryingId === contract.contractId}
                />
              ))}
              {verificationNeeded
                .slice(0, Math.max(0, 5 - attention.length))
                .map((obligation) => (
                  <VerificationRow key={obligation.id} obligation={obligation} />
                ))}
            </div>
          ) : (
            <EmptyState title={loading ? "Loading contracts…" : "No contracts need attention."}>
              Failed processing runs and obligations needing PDF verification will appear here.
            </EmptyState>
          )}
        </SectionCard>

        <SectionCard
          action={<Link className="text-sm font-semibold text-teal-700 hover:text-teal-900" to={routePaths.obligations}>View all</Link>}
          title="Upcoming Deadlines"
        >
          {deadlines.length ? (
            <div className="space-y-3">{deadlines.map((item) => <DeadlineRow key={item.id} obligation={item} />)}</div>
          ) : (
            <EmptyState title={loading ? "Loading obligations…" : "No upcoming deadlines."}>
              Dated obligations returned by the API will appear here.
            </EmptyState>
          )}
        </SectionCard>
      </div>

      <UploadContractDialog onClose={() => setUploadOpen(false)} open={uploadOpen} />
    </ContentContainer>
  );
}
