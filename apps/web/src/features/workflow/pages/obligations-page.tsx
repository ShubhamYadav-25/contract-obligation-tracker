/**
 * @file Defines routed feature page components for the contract tracker.
 */
import { useMemo, useState } from "react";
import { obligationStatuses } from "@contract-obligation-tracker/shared";
import {
  CalendarClock,
  CheckCircle2,
  CircleX,
  Clock3,
  Download,
  ExternalLink,
  FileSearch,
  Printer,
} from "lucide-react";

import { routePaths } from "@/app/route-paths.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import { Select } from "@/components/ui/select.js";
import { cx } from "@/utils/cx.js";
import { useObligations } from "@/features/obligations/hooks/use-obligations.js";
import type {
  ObligationDueDateRangeFilter,
  ObligationReminderFilter,
  ObligationStatus,
  ObligationSummary,
} from "@/features/obligations/types/obligation.js";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  PaginationControls,
  SearchInput,
  StatusBadge,
  TableHead,
  TableSkeleton,
  formatStatusLabel,
  statusTone,
} from "../components.js";
import { TableActionLink } from "../components/table-action-link.js";
import { sourceLinkState } from "../source-navigation.js";

const listPageSize = 10;

const obligationStatusLabels: Record<ObligationStatus, string> = {
  UPCOMING: "Upcoming",
  DUE: "Due",
  MET: "Met",
  MISSED: "Missed",
};

const obligationStatusCardStyles: Record<ObligationStatus, string> = {
  UPCOMING: "border-sky-200 border-t-sky-400 bg-gradient-to-br from-white to-sky-50 text-sky-900",
  DUE: "border-amber-200 border-t-amber-400 bg-gradient-to-br from-white to-amber-50 text-amber-950",
  MET: "border-emerald-200 border-t-emerald-400 bg-gradient-to-br from-white to-emerald-50 text-emerald-950",
  MISSED: "border-rose-200 border-t-rose-400 bg-gradient-to-br from-white to-rose-50 text-rose-950",
};

const obligationStatusCountsFallback: Record<ObligationStatus, number> = {
  UPCOMING: 0,
  DUE: 0,
  MET: 0,
  MISSED: 0,
};

const obligationStatusIcons = {
  UPCOMING: CalendarClock,
  DUE: Clock3,
  MET: CheckCircle2,
  MISSED: CircleX,
} as const;

const reminderFilterLabels: Record<ObligationReminderFilter, string> = {
  PENDING: "Pending reminders",
  ENQUEUED: "Enqueued reminders",
  PROCESSING: "Processing reminders",
  DELIVERED: "Delivered reminders",
  RETRY_PENDING: "Retry pending",
  FAILED: "Failed reminders",
  CANCELLED: "Cancelled reminders",
  NONE: "No reminder",
};

const dueDateRangeLabels: Record<ObligationDueDateRangeFilter, string> = {
  OVERDUE: "Overdue",
  NEXT_7_DAYS: "Next 7 days",
  NEXT_30_DAYS: "Next 30 days",
};

/**
 * @description Performs the days remaining helper operation for this module.
 * @param {string | undefined} dueAt - Input value for due at.
 * @returns {number | null} Result of the days remaining operation.
 */
function daysRemaining(dueAt: string | undefined): number | null {
  if (!dueAt) return null;
  return Math.ceil((Date.parse(dueAt) - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * @description Performs the days remaining class name helper operation for this module.
 * @param {number | null} days - Input value for days.
 * @returns {string} Result of the days remaining class name operation.
 */
function daysRemainingClassName(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days < 0) return "font-semibold text-rose-700";
  if (days <= 5) return "font-semibold text-amber-700";
  return "font-semibold text-emerald-700";
}

function needsVerification(obligation: ObligationSummary): boolean {
  return obligation.reviewStatus === "REVIEW_REQUIRED";
}

/**
 * @description Renders the obligation mobile card component for the contract tracker UI.
 * @param {{ readonly obligation: ObligationSummary; readonly selected: boolean; readonly onSelectedChange: (selected: boolean) => void; }} { obligation, selected, onSelectedChange, } - Input value for { obligation, selected, on selected change, }.
 * @returns {JSX.Element} Result of the obligation mobile card operation.
 */
function ObligationMobileCard({
  obligation,
  selected,
  onSelectedChange,
}: {
  readonly obligation: ObligationSummary;
  readonly selected: boolean;
  readonly onSelectedChange: (selected: boolean) => void;
}) {
  const days = daysRemaining(obligation.dueAt);

  return (
    <article
      className={cx(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-card transition",
        selected ? "bg-teal-50 ring-1 ring-teal-200" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          aria-label={`Select ${obligation.title}`}
          checked={selected}
          className="mt-1 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          onChange={(event) => onSelectedChange(event.target.checked)}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-6 text-slate-950">{obligation.title}</h3>
            <div className="flex flex-wrap justify-end gap-2">
              {needsVerification(obligation) ? (
                <StatusBadge label="Verify with PDF" tone="warning" />
              ) : null}
              <StatusBadge
                label={formatStatusLabel(obligation.status)}
                tone={statusTone(obligation.status)}
              />
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {obligation.contractDisplayName ?? obligation.contractId}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Due Date</dt>
          <dd className="mt-1 text-slate-900">
            {obligation.dueAt ? new Date(obligation.dueAt).toLocaleDateString() : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Days</dt>
          <dd className={cx("mt-1", daysRemainingClassName(days))}>
            {days === null ? "Unavailable" : days}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Reminder</dt>
          <dd className="mt-1 text-slate-700">{obligation.reminderStatus ?? "No reminder"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Contract</dt>
          <dd className="mt-1 truncate text-slate-700">
            {obligation.contractDisplayName ?? obligation.contractId}
          </dd>
        </div>
      </dl>
      <div className="sticky bottom-0 mt-4 flex gap-2 bg-white pt-3">
        <TableActionLink
          icon={FileSearch}
          state={sourceLinkState(obligation.sourceAnchors?.[0], obligation.id)}
          to={routePaths.contractDetail(obligation.contractId)}
        >
          View Source
        </TableActionLink>
        <TableActionLink icon={ExternalLink} to={routePaths.obligationDetail(obligation.id)}>
          Details
        </TableActionLink>
      </div>
    </article>
  );
}

/**
 * @description Renders the obligations page component for the contract tracker UI.
 * @returns {JSX.Element} Result of the obligations page operation.
 */
export function ObligationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | undefined>();
  const [reminderFilter, setReminderFilter] = useState<ObligationReminderFilter | undefined>();
  const [dueDateRange, setDueDateRange] = useState<ObligationDueDateRangeFilter | undefined>();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const obligationQueryInput = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(reminderFilter ? { reminderStatus: reminderFilter } : {}),
    ...(dueDateRange ? { dueDateRange } : {}),
    limit: listPageSize + 1,
    offset: pageIndex * listPageSize,
  };
  const obligations = useObligations(undefined, obligationQueryInput);
  const obligationItems = obligations.data?.items ?? [];
  const visibleObligations = obligationItems.slice(0, listPageSize);
  const hasNextPage = obligationItems.length > listPageSize;
  const pageStart = pageIndex * listPageSize + 1;
  const pageEnd = pageIndex * listPageSize + visibleObligations.length;
  const statusCounts = obligations.data?.statusCounts ?? obligationStatusCountsFallback;
  const allVisibleSelected =
    visibleObligations.length > 0 && visibleObligations.every((item) => selectedIds.has(item.id));
  const activeFilterLabel = statusFilter
    ? `Filtered by ${obligationStatusLabels[statusFilter]}`
    : null;
  const hasActiveFilters = Boolean(search.trim() || statusFilter || reminderFilter || dueDateRange);

  /**
   * @description Performs the set row selected helper operation for this module.
   * @param {string} obligationId - Input value for obligation id.
   * @param {boolean} selected - Input value for selected.
   * @returns {void} Result of the set row selected operation.
   */
  function setRowSelected(obligationId: string, selected: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(obligationId);
      } else {
        next.delete(obligationId);
      }
      return next;
    });
  }

  /**
   * @description Performs the toggle visible rows helper operation for this module.
   * @param {boolean} selected - Input value for selected.
   * @returns {void} Result of the toggle visible rows operation.
   */
  function toggleVisibleRows(selected: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const obligation of visibleObligations) {
        if (selected) {
          next.add(obligation.id);
        } else {
          next.delete(obligation.id);
        }
      }
      return next;
    });
  }

  /**
   * @description Performs the clear filters helper operation for this module.
   * @returns {void} Result of the clear filters operation.
   */
  function clearFilters(): void {
    setSearch("");
    setStatusFilter(undefined);
    setReminderFilter(undefined);
    setDueDateRange(undefined);
    setPageIndex(0);
    setSelectedIds(new Set());
  }

  /**
   * @description Performs the export csv helper operation for this module.
   * @returns {void} Result of the export csv operation.
   */
  function exportCsv(): void {
    const header = [
      "Obligation",
      "Contract",
      "Due Date",
      "Days Remaining",
      "Status",
      "Reminder Status",
    ];
    const rows = visibleObligations.map((item) => {
      const days = daysRemaining(item.dueAt);
      return [
        item.title,
        item.contractDisplayName ?? item.contractId,
        item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "",
        days === null ? "" : String(days),
        formatStatusLabel(item.status),
        item.reminderStatus ?? "No reminder",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "obligations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ContentContainer>
      <PageHeader
        description="Track upcoming, due, completed, and missed contractual commitments."
        title="Obligations"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {obligationStatuses.map((status) => {
          const Icon = obligationStatusIcons[status];
          const active = statusFilter === status;
          return (
            <button
              aria-pressed={active}
              className={cx(
                "rounded-xl border border-t-4 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:shadow-focus",
                obligationStatusCardStyles[status],
                active ? "ring-2 ring-teal-600 ring-offset-2" : "",
              )}
              key={status}
              onClick={() => {
                setStatusFilter(active ? undefined : status);
                setPageIndex(0);
                setSelectedIds(new Set());
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">
                    {obligationStatusLabels[status]}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {obligations.isLoading
                      ? "…"
                      : obligations.isSuccess
                        ? String(statusCounts[status])
                        : "Unavailable"}
                  </p>
                  <p className="mt-2 text-xs font-semibold">
                    {active ? "Selected · click to clear" : "Filter obligations"}
                  </p>
                </div>
                <Icon aria-hidden className="size-5" />
              </div>
            </button>
          );
        })}
      </div>
      <FilterBar>
        <SearchInput
          onChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          placeholder="Search obligation, description, or contract"
          value={search}
        />
        <Select
          aria-label="Status filter"
          className="min-w-40"
          value={statusFilter ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setStatusFilter(value === "ALL" ? undefined : (value as ObligationStatus));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All statuses</option>
          {obligationStatuses.map((status) => (
            <option key={status} value={status}>
              {obligationStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Reminder filter"
          className="min-w-44"
          value={reminderFilter ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setReminderFilter(value === "ALL" ? undefined : (value as ObligationReminderFilter));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All reminders</option>
          {Object.entries(reminderFilterLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Date range"
          className="min-w-40"
          value={dueDateRange ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setDueDateRange(value === "ALL" ? undefined : (value as ObligationDueDateRangeFilter));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All due dates</option>
          {Object.entries(dueDateRangeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-card">
          <button
            className="inline-flex h-10 items-center gap-1.5 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px"
            onClick={exportCsv}
            type="button"
          >
            <Download aria-hidden className="size-4" />
            CSV
          </button>
          <button
            className="inline-flex h-10 items-center gap-1.5 border-l border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px"
            onClick={() => window.print()}
            type="button"
          >
            <Printer aria-hidden className="size-4" />
            Print
          </button>
        </div>
        <Button
          disabled={!hasActiveFilters && pageIndex === 0 && selectedIds.size === 0}
          onClick={clearFilters}
          type="button"
          variant="secondary"
        >
          Clear
        </Button>
      </FilterBar>
      {obligations.isLoading ? <TableSkeleton /> : null}
      {obligations.isError ? (
        <ErrorState
          detail="The backend obligation route returned an error. Rows are shown only when Postgres returns them."
          title="Obligation API unavailable."
        />
      ) : null}
      {obligations.isSuccess && visibleObligations.length === 0 ? (
        <EmptyState title="No obligations match the current filters.">
          Obligations will appear here after the worker extracts and stores them.
        </EmptyState>
      ) : null}
      {obligations.isSuccess && visibleObligations.length > 0 ? (
        <>
          {activeFilterLabel ? (
            <div className="mb-3 inline-flex rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800">
              {activeFilterLabel}
            </div>
          ) : null}
          <div className="hidden md:block">
            <DataTable minWidth="min-w-[980px]">
              <TableHead
                columns={["", "Obligation", "Parties", "Timing", "Status", "Source", "Details"]}
              />
              <tbody className="divide-y divide-slate-200">
                {visibleObligations.map((item) => {
                  const days = daysRemaining(item.dueAt);
                  const selected = selectedIds.has(item.id);
                  return (
                    <tr
                      className={cx(
                        "transition-colors hover:bg-[#F0F9FF]",
                        selected ? "bg-teal-50" : "",
                      )}
                      key={item.id}
                    >
                      <td className="px-5 py-4">
                        <input
                          aria-label={`Select ${item.title}`}
                          checked={selected}
                          className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          onChange={(event) => setRowSelected(item.id, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="max-w-md px-5 py-4">
                        <p className="font-semibold leading-6 text-slate-950">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                          {item.description}
                        </p>
                        <p className="mt-2 truncate text-xs font-semibold text-slate-500">
                          {item.contractDisplayName ?? item.contractId}
                        </p>
                        {needsVerification(item) ? (
                          <div className="mt-2">
                            <StatusBadge label="Verify with PDF" tone="warning" />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {item.responsibleParty ?? "Unavailable"}
                        </p>
                        {item.counterparty ? (
                          <p className="mt-1 text-xs text-slate-500">To {item.counterparty}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <p>
                          {item.dueAt
                            ? new Date(item.dueAt).toLocaleDateString()
                            : (item.frequency ?? item.timingType ?? "Not set")}
                        </p>
                        <p className={cx("mt-1 text-xs", daysRemainingClassName(days))}>
                          {days === null ? "Days unavailable" : `${days} days remaining`}
                        </p>
                        {item.triggerEvent ? (
                          <p className="mt-1 max-w-48 truncate text-xs text-slate-500">
                            {item.triggerEvent}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          label={formatStatusLabel(item.status)}
                          tone={statusTone(item.status)}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          {item.reminderStatus ?? "No reminder"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <TableActionLink
                          icon={FileSearch}
                          state={sourceLinkState(item.sourceAnchors?.[0], item.id)}
                          to={routePaths.contractDetail(item.contractId)}
                        >
                          {needsVerification(item) ? "Verify PDF" : "View Source"}
                        </TableActionLink>
                      </td>
                      <td className="px-5 py-4">
                        <TableActionLink
                          icon={ExternalLink}
                          to={routePaths.obligationDetail(item.id)}
                        >
                          Details
                        </TableActionLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                checked={allVisibleSelected}
                className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                onChange={(event) => toggleVisibleRows(event.target.checked)}
                type="checkbox"
              />
              Select visible rows
            </label>
          </div>
          <div className="space-y-3 md:hidden">
            {visibleObligations.map((item) => (
              <ObligationMobileCard
                key={item.id}
                obligation={item}
                selected={selectedIds.has(item.id)}
                onSelectedChange={(selected) => setRowSelected(item.id, selected)}
              />
            ))}
          </div>
          <PaginationControls
            label={`Showing ${pageStart}-${pageEnd}`}
            nextDisabled={!hasNextPage || obligations.isFetching}
            onNext={() => setPageIndex((current) => current + 1)}
            onPrevious={() => setPageIndex((current) => Math.max(current - 1, 0))}
            previousDisabled={pageIndex === 0 || obligations.isFetching}
          />
        </>
      ) : null}
    </ContentContainer>
  );
}
