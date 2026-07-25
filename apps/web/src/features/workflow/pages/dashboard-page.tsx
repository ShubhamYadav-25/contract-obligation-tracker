/**
 * @file Defines routed feature page components for the contract tracker.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import { useContracts } from "@/features/contracts/hooks/use-contracts.js";
import { useObligations } from "@/features/obligations/hooks/use-obligations.js";
import {
  EmptyState,
  KpiCard,
  LoadingSkeleton,
  SectionCard,
  StatusBadge,
  TableSkeleton,
  formatStatusLabel,
  statusTone,
} from "../components.js";
import {
  RecentContractsTable,
  UploadContractDialog,
  contractToUploadRecord,
} from "../components/upload-contract-dialog.js";

/**
 * @description Renders the dashboard page component for the contract tracker UI.
 * @returns {JSX.Element} Result of the dashboard page operation.
 */
export function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const contracts = useContracts();
  const obligations = useObligations();
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads;
  const obligationRows = obligations.data?.items ?? [];
  const nextDeadlines = obligationRows
    .filter((item) => item.dueAt && item.status !== "MET")
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))
    .slice(0, 5);
  const storedCount = visibleUploads.filter((item) =>
    [
      "STORED",
      "QUEUED",
      "PROCESSING",
      "PARSING",
      "OCR_PROCESSING",
      "TEXT_SEGMENTED",
      "COMPLETED",
      "REVIEW_REQUIRED",
    ].includes(item.status),
  ).length;
  const segmentedCount = visibleUploads.filter((item) => (item.textPageCount ?? 0) > 0).length;

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)} type="button">
            Upload Contract
          </Button>
        }
        description="Monitor contracts requiring review and obligations approaching their deadlines."
        title="Contract Overview"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          helper="Backend list"
          label="Total Contracts"
          tone="info"
          value={
            contracts.isError
              ? "Unavailable"
              : contracts.isLoading
                ? "Loading"
                : String(visibleUploads.length)
          }
        />
        <KpiCard
          helper="Stored by backend"
          label="Stored Contracts"
          tone="success"
          value={String(storedCount)}
        />
        <KpiCard
          helper="Text pages persisted"
          label="Text Segmented"
          tone="success"
          value={String(segmentedCount)}
        />
        <KpiCard
          helper="Backend list"
          label="Obligations"
          value={
            obligations.isError
              ? "Unavailable"
              : obligations.isLoading
                ? "Loading"
                : String(obligations.data?.total ?? obligationRows.length)
          }
        />
      </div>
      {contracts.isError ? (
        <div className="mb-5">
          <InlineError error={contracts.error} />
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Attention Required">
          {visibleUploads.length === 0 ? (
            <EmptyState title="No contracts require attention.">
              Upload a contract to start backend processing.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {visibleUploads.slice(0, 5).map((record) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={record.contractId}
                >
                  <div>
                    <StatusBadge
                      label={formatStatusLabel(record.status)}
                      tone={statusTone(record.status)}
                    />
                    <h3 className="mt-2 text-sm font-semibold">{record.displayName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      Open the workspace to view processing status and parsed text pages.
                    </p>
                  </div>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium hover:bg-surface focus-visible:shadow-focus"
                    to={routePaths.contractDetail(record.contractId)}
                  >
                    Open Contract
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Next Deadlines">
          {obligations.isLoading ? <LoadingSkeleton label="Loading obligation deadlines" /> : null}
          {obligations.isError ? <InlineError error={obligations.error} /> : null}
          {obligations.isSuccess && nextDeadlines.length === 0 ? (
            <EmptyState title="No obligation deadlines available.">
              Deadlines will appear when obligations with due dates are stored.
            </EmptyState>
          ) : null}
          {nextDeadlines.length > 0 ? (
            <div className="space-y-3">
              {nextDeadlines.map((item) => (
                <div
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={item.id}
                >
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {item.contractDisplayName ?? item.contractId}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatStatusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
                    <span className="text-sm text-muted">
                      {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No due date"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
        <SectionCard className="xl:col-span-2" title="Recent Contracts">
          {contracts.isLoading ? (
            <TableSkeleton />
          ) : (
            <RecentContractsTable uploads={visibleUploads.slice(0, 5)} />
          )}
        </SectionCard>
      </div>
      <UploadContractDialog onClose={() => setUploadOpen(false)} open={uploadOpen} />
    </ContentContainer>
  );
}
