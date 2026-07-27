/**
 * @file Defines feature-level web application code for the contract tracker.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Check,
  Download,
  ExternalLink,
  FileSearch,
  Info,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import { PdfViewerContainer } from "@/components/features/pdf-reader/pdf-viewer-container.js";
import type { PdfSourceNavigationCommand } from "@/components/features/pdf-reader/pdf-source-navigation.js";
import { cx } from "@/utils/cx.js";
import { queryKeys } from "@/services/query-keys.js";
import { useContract } from "../contracts/hooks/use-contract.js";
import { useProcessingStatus } from "../contracts/hooks/use-processing-status.js";
import { useReprocessContract } from "../contracts/hooks/use-reprocess-contract.js";
import type { ContractProcessingStatus } from "../contracts/types/contracts.js";
import { useObligations } from "../obligations/hooks/use-obligations.js";
import {
  useContractActivity,
  useContractProfile,
  useProcessingHistory,
} from "./hooks/use-operations.js";
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
import { ContractProfileEditor } from "./components/contract-profile-editor.js";
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
  const status = useProcessingStatus(contractId, contract.isSuccess);
  const reprocessMutation = useReprocessContract();
  const history = useProcessingHistory(contractId);
  const obligations = useObligations(contractId);

  useEffect(() => {
    if (!status.isSuccess || !terminalProcessingStatuses.has(status.data.status)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.textPages(contractId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
  }, [contractId, queryClient, status.data?.status, status.isSuccess]);

  const isReprocessingAllowed =
    status.isSuccess &&
    status.data.status !== "PROCESSING" &&
    status.data.status !== "QUEUED";

  const runs = history.data?.items ?? [];
  const warnings = runs.filter((run) => run.errorMessage);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="Processing History">
        {history.isLoading ? <TableSkeleton /> : null}
        {history.isError ? <InlineError error={history.error} /> : null}
        {history.isSuccess && runs.length === 0 ? (
          <EmptyState title="No processing attempts found.">Processing runs will appear after upload.</EmptyState>
        ) : null}
        <div className="space-y-3">
          {runs.map((run) => (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3" key={run.id}>
              <div className={cx("mt-1 size-3 rounded-full", run.status === "FAILED" ? "bg-rose-600" : "bg-emerald-600")} />
              <div>
                <p className="text-sm font-bold">{formatStatusLabel(run.status)} · Attempt {run.attemptNumber}</p>
                <p className="text-xs text-slate-500">{run.updatedAt.toLocaleString()}</p>
                {run.errorMessage ? <p className="mt-1 text-xs text-rose-700">{run.errorMessage}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Workspace Status">
        <div className="space-y-3">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            {obligations.isSuccess ? `${obligations.data.total} obligations stored for this contract.` : "Loading obligation totals…"}
          </div>
          {warnings.length ? warnings.map((run) => (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" key={run.id}>
              {run.errorStage ? `${run.errorStage}: ` : ""}{run.errorMessage}
            </div>
          )) : <p className="text-sm text-slate-500">No processing warnings are currently reported.</p>}
          <Button
            type="button"
            variant="secondary"
            disabled={reprocessMutation.isPending || !isReprocessingAllowed}
            onClick={() => reprocessMutation.mutate(contractId)}
          >
            <RotateCw className={cx("h-4 w-4", reprocessMutation.isPending && "animate-spin")} />
            {reprocessMutation.isPending ? "Retrying…" : "Retry Processing"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

/**
 * @description Renders the contract workspace page component for the contract tracker UI.
 * @returns {JSX.Element} Result of the contract workspace page operation.
 */
export function ContractWorkspacePage() {
  const contractId = useParams().contractId ?? "";
  const contract = useContract(contractId);
  const profile = useContractProfile(contractId);
  const obligations = useObligations(contractId);
  const location = useLocation();
  const locationState = location.state as ContractWorkspaceLocationState | null;
  const requestedTab = locationState?.tab === "Review & Evidence" ? "Review & Evidence" : null;
  const [tab, setTab] = useState(requestedTab ?? "Overview");
  const tabs = ["Overview", "Extracted Fields", "Obligations", "Source Document", "Activity"];
  const nextObligation = [...(obligations.data?.items ?? [])]
    .filter((item) => item.dueAt && item.status !== "MET")
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))[0];
  const displayName = contract.data?.displayName ?? (contract.isLoading ? "Loading…" : "Contract");

  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  return (
    <ContentContainer>
      <div className="mb-2 text-xs font-semibold text-slate-500">
        <Link className="hover:text-slate-900" to={routePaths.contracts}>
          Contracts
        </Link>{" "}
        / {displayName}
      </div>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {contract.data
              ? `Uploaded ${new Date(contract.data.createdAt).toLocaleString()}${
                  contract.data.externalRef ? ` · ${contract.data.externalRef}` : ""
                }`
              : "Loading contract metadata…"}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
              {formatStatusLabel(contract.data?.processing?.status)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
              {obligations.data?.total ?? 0} obligations
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900">
              <Calendar size={13} />
              {nextObligation?.dueAt
                ? `Next due ${new Date(nextObligation.dueAt).toLocaleDateString()}`
                : "No dated obligation"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button onClick={() => setTab("Extracted Fields")} type="button" className="bg-[#00796B] hover:bg-[#00695C] text-white gap-2">
            <ShieldCheck size={16} />
            Review Evidence
          </Button>
          <Button onClick={() => setTab("Source Document")} type="button" variant="secondary" className="gap-2">
            <Download size={16} />
            Open Source
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Parties</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.parties.join("; ") || "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Contract value</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.contractValue ? `${profile.data.currency ?? ""} ${profile.data.contractValue}`.trim() : "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Effective date</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.effectiveDate ? new Date(profile.data.effectiveDate).toLocaleDateString() : "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Expiration date</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.expirationDate ? new Date(profile.data.expirationDate).toLocaleDateString() : "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Renewal type</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.renewalType ?? "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Notice period</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.noticePeriodDays === null || profile.data?.noticePeriodDays === undefined ? "Unavailable" : `${profile.data.noticePeriodDays} days`}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Next obligation</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{profile.data?.nextObligationSummary ?? nextObligation?.title ?? "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Extraction confidence</p>
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            {profile.data?.extractionConfidence === null || profile.data?.extractionConfidence === undefined
              ? "Unavailable"
              : `${Math.round(profile.data.extractionConfidence * 100)}%`}
          </span>
        </div>
      </div>

      <ContractProfileEditor
        contractId={contractId}
        profile={profile.data}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 border-b border-slate-200">
          <div className="flex min-w-max gap-4" role="tablist">
            {tabs.map((item) => (
              <button
                aria-selected={tab === item}
                className={
                  tab === item
                    ? "border-b-2 border-[#00796B] pb-3 text-sm font-bold text-[#00796B]"
                    : "border-b-2 border-transparent pb-3 text-sm font-medium text-slate-500 hover:text-slate-900"
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
        {tab === "Overview" || tab === "Summary" ? <SummaryTab contractId={contractId} /> : null}
        {tab === "Extracted Fields" || tab === "Review & Evidence" ? (
          <ReviewEvidenceTab
            contractId={contractId}
            {...(locationState?.obligationId
              ? { selectedObligationId: locationState.obligationId }
              : {})}
            sourceCommand={locationState?.sourceCommand ?? null}
          />
        ) : null}
        {tab === "Obligations" ? <WorkspaceObligationsTab contractId={contractId} /> : null}
        {tab === "Source Document" ? <PdfViewerContainer contractId={contractId} initialPage={1} sourceCommand={null} /> : null}
        {tab === "Activity" ? <ContractActivityTab contractId={contractId} /> : null}
      </div>
    </ContentContainer>
  );
}

function ContractActivityTab({ contractId }: { readonly contractId: string }) {
  const activity = useContractActivity(contractId);
  if (activity.isLoading) return <TableSkeleton />;
  if (activity.isError) return <InlineError error={activity.error} />;
  const events = activity.data?.items ?? [];
  if (events.length === 0) {
    return (
      <EmptyState title="No contract activity recorded.">
        Audit events will appear here as contract operations are performed.
      </EmptyState>
    );
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li className="rounded-lg border border-slate-200 bg-white p-4" key={event.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">{formatStatusLabel(event.action)}</p>
            <time className="text-xs text-slate-500">{event.createdAt.toLocaleString()}</time>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {event.actorType} · {event.actorId}
          </p>
        </li>
      ))}
    </ol>
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
  const contract = useContract(contractId);
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
        {contract.isLoading ? <LoadingSkeleton label="Loading contract PDF" /> : null}
        {contract.isError ? (
          <ErrorState
            detail="This contract id is not available in the current production database. Return to the contracts list and open a stored contract."
            title="Contract not found."
          />
        ) : null}
        {contract.isSuccess && !contract.data.currentDocument ? (
          <ErrorState
            detail="The contract exists, but no stored PDF is attached to its current document."
            title="PDF document is missing."
          />
        ) : null}
        {contract.isSuccess && contract.data.currentDocument ? (
          <PdfViewerContainer
            contractId={contractId}
            initialPage={sourceCommand?.payload.pageNumber ?? 1}
            sourceCommand={activeSourceCommand}
          />
        ) : null}
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
