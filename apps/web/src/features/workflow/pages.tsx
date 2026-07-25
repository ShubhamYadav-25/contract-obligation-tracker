/**
 * @file Defines feature-level web application code for the contract tracker.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileSearch } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { PdfViewerContainer } from "@/components/features/pdf-reader/pdf-viewer-container.js";
import type { PdfSourceNavigationCommand } from "@/components/features/pdf-reader/pdf-source-navigation.js";
import { cx } from "@/utils/cx.js";
import { queryKeys } from "@/services/query-keys.js";
import { useContract } from "../contracts/hooks/use-contract.js";
import { useProcessingStatus } from "../contracts/hooks/use-processing-status.js";
import type { ContractProcessingStatus } from "../contracts/types/contracts.js";
import { useObligations } from "../obligations/hooks/use-obligations.js";
import type { ObligationSourceAnchor, ObligationSummary } from "../obligations/types/obligation.js";
import {
  AuditTimeline,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingSkeleton,
  ProcessingTimeline,
  SectionCard,
  StatusBadge,
  TableSkeleton,
  formatStatusLabel,
  statusTone,
} from "./components.js";
import {
  EditableObligationPanel,
  ObligationMetaItem,
  ObligationSourceChips,
} from "./components/obligation-evidence.js";
import { TableActionLink } from "./components/table-action-link.js";
import {
  sourceCommandFromAnchor,
  sourceLinkState,
  type ContractWorkspaceLocationState,
} from "./source-navigation.js";

export { DashboardPage } from "./pages/dashboard-page.js";
export { ContractsPage } from "./pages/contracts-page.js";
export { ObligationsPage } from "./pages/obligations-page.js";

const terminalProcessingStatuses = new Set<ContractProcessingStatus>([
  "TEXT_SEGMENTED",
  "COMPLETED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

/**
 * @description Renders the summary tab component for the contract tracker UI.
 * @param {{ readonly contractId: string }} { contractId } - Input value for { contract id }.
 * @returns {JSX.Element} Result of the summary tab operation.
 */
function SummaryTab({ contractId }: { readonly contractId: string }) {
  const queryClient = useQueryClient();
  const contract = useContract(contractId);
  const status = useProcessingStatus(contractId);
  const obligations = useObligations(contractId);
  const detail = contract.data;
  const obligationRows = obligations.data?.items ?? [];
  const unresolvedObligations = obligationRows.filter((item) => item.status !== "MET").length;
  const nextDeadline = obligationRows
    .filter((item) => item.dueAt && item.status !== "MET")
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))[0];

  useEffect(() => {
    if (!status.isSuccess || !terminalProcessingStatuses.has(status.data.status)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.textPages(contractId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
  }, [contractId, queryClient, status.data?.status, status.isSuccess]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Key Details">
        {contract.isLoading ? <LoadingSkeleton label="Loading contract detail" /> : null}
        {contract.isError ? <InlineError error={contract.error} /> : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Display Name</dt>
            <dd className="mt-2">{detail?.displayName ?? "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Original File</dt>
            <dd className="mt-2">{detail?.currentDocument?.originalFilename ?? "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Text Pages</dt>
            <dd className="mt-2">{detail ? detail.text.pageCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Segments</dt>
            <dd className="mt-2">{detail ? detail.text.segmentCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">OCR Pages</dt>
            <dd className="mt-2">{detail ? detail.text.ocrPageCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">SHA-256</dt>
            <dd className="mt-2 break-all font-mono text-xs">
              {detail?.currentDocument?.checksumSha256 ?? "Unavailable"}
            </dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard title="Backend Status">
        {status.isLoading ? <LoadingSkeleton label="Loading backend status" /> : null}
        {status.isError ? <InlineError error={status.error} /> : null}
        {status.isSuccess ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge
                label={formatStatusLabel(status.data.status)}
                tone={statusTone(status.data.status)}
              />
              <span className="text-sm text-muted">Attempt {status.data.attemptNumber}</span>
            </div>
            <ProcessingTimeline status={status.data.status} />
            {status.data.status === "FAILED" ? (
              <ErrorState
                detail={
                  status.data.errorMessage ??
                  "The original PDF remains safely stored. Retry support is not exposed by the backend route set yet."
                }
                title="Processing failed after upload."
              />
            ) : null}
          </>
        ) : null}
      </SectionCard>
      <SectionCard className="xl:col-span-2" title="Workflow Counts">
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            helper="Backend obligation API"
            label="Open Obligations"
            value={obligations.isSuccess ? String(unresolvedObligations) : "Unavailable"}
          />
          <KpiCard
            helper={detail?.extraction.provider ?? "Extractor pending"}
            label="Confirmed"
            value={detail ? String(detail.extraction.confirmedCount) : "Unavailable"}
          />
          <KpiCard
            helper="Extraction review gate"
            label="Needs Review"
            value={detail ? String(detail.extraction.reviewRequiredCount) : "Unavailable"}
          />
          <KpiCard
            helper="Rejected by verification"
            label="Rejected"
            value={detail ? String(detail.extraction.rejectedCount) : "Unavailable"}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <KpiCard
            helper="Backend obligation API"
            label="Total Obligations"
            value={obligations.isSuccess ? String(obligations.data.total) : "Unavailable"}
          />
          <KpiCard
            helper="Derived from obligation due dates"
            label="Next Obligation Deadline"
            value={
              obligations.isSuccess && nextDeadline?.dueAt
                ? new Date(nextDeadline.dueAt).toLocaleDateString()
                : "Unavailable"
            }
          />
        </div>
      </SectionCard>
    </div>
  );
}

/**
 * @description Renders the review evidence tab component for the contract tracker UI.
 * @param {{ readonly contractId: string; readonly selectedObligationId?: string; readonly sourceCommand?: PdfSourceNavigationCommand | null; }} { contractId, selectedObligationId, sourceCommand, } - Input value for { contract id, selected obligation id, source command, }.
 * @returns {JSX.Element} Result of the review evidence tab operation.
 */
function ReviewEvidenceTab({
  contractId,
  selectedObligationId,
  sourceCommand,
}: {
  readonly contractId: string;
  readonly selectedObligationId?: string;
  readonly sourceCommand?: PdfSourceNavigationCommand | null;
}) {
  const obligations = useObligations(contractId);
  const rows = obligations.data?.items ?? [];
  const [activeObligationId, setActiveObligationId] = useState(selectedObligationId ?? "");
  const [activeSourceCommand, setActiveSourceCommand] = useState<PdfSourceNavigationCommand | null>(
    sourceCommand ?? null,
  );
  const activeObligation =
    rows.find((obligation) => obligation.id === activeObligationId) ?? rows[0] ?? null;

  useEffect(() => {
    if (selectedObligationId) setActiveObligationId(selectedObligationId);
  }, [selectedObligationId]);

  useEffect(() => {
    if (sourceCommand) setActiveSourceCommand(sourceCommand);
  }, [sourceCommand]);

  useEffect(() => {
    if (!activeObligationId && rows[0]) setActiveObligationId(rows[0].id);
  }, [activeObligationId, rows]);

  /**
   * @description Performs the navigate to anchor helper operation for this module.
   * @param {ObligationSourceAnchor} anchor - Input value for anchor.
   * @returns {void} Result of the navigate to anchor operation.
   */
  function navigateToAnchor(anchor: ObligationSourceAnchor): void {
    const command = sourceCommandFromAnchor(anchor);
    if (command) setActiveSourceCommand(command);
  }

  return (
    <div className="grid min-h-[calc(100vh-260px)] gap-4 xl:grid-cols-[minmax(360px,0.82fr)_minmax(560px,1.18fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="shrink-0 border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold leading-7 text-slate-950">
                Obligation & Evidence
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Edit this obligation and use the source buttons to jump the PDF.
              </p>
            </div>
            {activeObligation ? (
              <StatusBadge
                label={formatStatusLabel(activeObligation.status)}
                tone={statusTone(activeObligation.status)}
              />
            ) : null}
          </div>
          {obligations.isLoading ? (
            <div className="mt-4">
              <TableSkeleton />
            </div>
          ) : null}
          {obligations.isError ? (
            <div className="mt-4">
              <InlineError error={obligations.error} />
            </div>
          ) : null}
          {obligations.isSuccess && rows.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No obligations found for this contract.">
                Obligations will appear here after extraction stores source-aware results.
              </EmptyState>
            </div>
          ) : null}
        </div>
        {activeObligation ? (
          <EditableObligationPanel
            obligation={activeObligation}
            onNavigateSource={navigateToAnchor}
          />
        ) : null}
      </section>
      <div className="review-pdf-pane min-w-0">
        <PdfViewerContainer
          contractId={contractId}
          initialPage={sourceCommand?.payload.pageNumber ?? 1}
          sourceCommand={activeSourceCommand}
        />
      </div>
    </div>
  );
}

/**
 * @description Renders the workspace obligations tab component for the contract tracker UI.
 * @param {{ readonly contractId: string }} { contractId } - Input value for { contract id }.
 * @returns {JSX.Element} Result of the workspace obligations tab operation.
 */
function WorkspaceObligationsTab({ contractId }: { readonly contractId: string }) {
  const obligations = useObligations(contractId);

  if (obligations.isLoading) return <TableSkeleton />;
  if (obligations.isError) {
    return <InlineError error={obligations.error} />;
  }
  const rows = obligations.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState title="No obligations found for this contract.">
        Obligations will appear after the worker extracts and stores them.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((item) => {
        const timingValue = item.dueAt
          ? new Date(item.dueAt).toLocaleDateString()
          : (item.frequency ?? item.timingType ?? "Not set");
        const confidenceValue =
          typeof item.confidence === "number"
            ? `${Math.round(item.confidence * 100)}%`
            : "Unavailable";

        return (
          <article
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"
            key={item.id}
          >
            <div className="grid gap-4 border-b border-slate-200 bg-slate-50/70 p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <StatusBadge
                    label={formatStatusLabel(item.status)}
                    tone={statusTone(item.status)}
                  />
                  {item.category ? <StatusBadge label={item.category} tone="info" /> : null}
                </div>
                <h2 className="text-base font-bold leading-6 text-slate-950">{item.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                <TableActionLink
                  icon={FileSearch}
                  state={sourceLinkState(item.sourceAnchors[0], item.id)}
                  to={routePaths.contractDetail(item.contractId)}
                >
                  View Source
                </TableActionLink>
                <TableActionLink icon={ExternalLink} to={routePaths.obligationDetail(item.id)}>
                  Details
                </TableActionLink>
              </div>
            </div>
            <div className="p-4">
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ObligationMetaItem
                  label="Responsible"
                  value={item.responsibleParty ?? "Unavailable"}
                  helper={item.counterparty ? `To ${item.counterparty}` : null}
                />
                <ObligationMetaItem
                  label="Timing"
                  value={timingValue}
                  helper={item.triggerEvent ?? item.timingType ?? null}
                />
                <ObligationMetaItem
                  label="Confidence"
                  value={confidenceValue}
                  helper={item.reviewStatus ?? null}
                />
                <ObligationMetaItem
                  label="Reminder"
                  value={item.reminderStatus ?? "No reminder"}
                  helper={
                    item.nextReminderAt ? new Date(item.nextReminderAt).toLocaleDateString() : null
                  }
                />
              </dl>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-normal text-slate-500">
                    Evidence
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {item.sourceAnchors.length} source
                    {item.sourceAnchors.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ObligationSourceChips obligation={item} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * @description Renders the contract workspace page component for the contract tracker UI.
 * @returns {JSX.Element} Result of the contract workspace page operation.
 */
export function ContractWorkspacePage() {
  const contractId = useParams().contractId ?? "";
  const location = useLocation();
  const locationState = location.state as ContractWorkspaceLocationState | null;
  const requestedTab = locationState?.tab === "Review & Evidence" ? "Review & Evidence" : null;
  const [tab, setTab] = useState(requestedTab ?? "Summary");
  const tabs = ["Summary", "Review & Evidence", "Obligations", "Activity"];

  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  return (
    <ContentContainer>
      <div className="mb-3 text-sm text-muted">
        <Link className="hover:text-teal-800" to={routePaths.contracts}>
          Contracts
        </Link>{" "}
        / {contractId}
      </div>
      <PageHeader
        description="Verify stored status, extracted evidence, obligations, and auditability for one contract."
        title={`Contract ${contractId}`}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge label="Status polled from backend" tone="info" />
          <StatusBadge label="Review unavailable" />
        </div>
      </PageHeader>
      <div className="rounded-lg border border-border bg-white p-5">
        <div className="mb-5 overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1" role="tablist">
            {tabs.map((item) => (
              <button
                aria-selected={tab === item}
                className={
                  tab === item
                    ? "border-b-2 border-accent px-3 py-3 text-sm font-medium text-teal-800"
                    : "border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted hover:text-ink"
                }
                key={item}
                onClick={() => setTab(item)}
                role="tab"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {tab === "Summary" ? <SummaryTab contractId={contractId} /> : null}
        {tab === "Review & Evidence" ? (
          <ReviewEvidenceTab
            contractId={contractId}
            {...(locationState?.obligationId
              ? { selectedObligationId: locationState.obligationId }
              : {})}
            sourceCommand={locationState?.sourceCommand ?? null}
          />
        ) : null}
        {tab === "Obligations" ? <WorkspaceObligationsTab contractId={contractId} /> : null}
        {tab === "Activity" ? <AuditTimeline /> : null}
      </div>
    </ContentContainer>
  );
}
