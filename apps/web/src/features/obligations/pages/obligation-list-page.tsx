import { useState } from "react";
import { obligationStatuses } from "@contract-obligation-tracker/shared";

import { EmptyState } from "../../../components/feedback/empty-state.js";
import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { cx } from "../../../utils/cx.js";
import { ObligationTable } from "../components/obligation-table.js";
import { useObligations } from "../hooks/use-obligations.js";
import type { ObligationStatus } from "../types/obligation.js";

const statusLabels: Record<ObligationStatus, string> = {
  UPCOMING: "Upcoming",
  DUE: "Due",
  MET: "Met",
  MISSED: "Missed",
};

const statusCardStyles: Record<ObligationStatus, string> = {
  UPCOMING: "border-sky-200 bg-sky-50 text-sky-900",
  DUE: "border-amber-200 bg-amber-50 text-amber-950",
  MET: "border-emerald-200 bg-emerald-50 text-emerald-950",
  MISSED: "border-red-200 bg-red-50 text-red-950",
};

const emptyStatusCounts: Record<ObligationStatus, number> = {
  UPCOMING: 0,
  DUE: 0,
  MET: 0,
  MISSED: 0,
};

export function ObligationListPage() {
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | undefined>();
  const obligations = useObligations(undefined, statusFilter ? { status: statusFilter } : {});
  const statusCounts = obligations.data?.statusCounts ?? emptyStatusCounts;
  const tableItems = obligations.data?.items ?? [];

  return (
    <ContentContainer>
      <PageHeader
        description="Track due dates and authoritative obligation states."
        title="Obligations"
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {obligationStatuses.map((status) => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              aria-pressed={isActive}
              className={cx(
                "rounded-lg border p-4 text-left shadow-sm transition focus-visible:shadow-focus",
                statusCardStyles[status],
                isActive ? "ring-2 ring-accent ring-offset-2" : "hover:border-accent",
              )}
              type="button"
              onClick={() => setStatusFilter(isActive ? undefined : status)}
            >
              <span className="text-sm font-medium">{statusLabels[status]}</span>
              <span className="mt-3 block text-3xl font-semibold leading-none">
                {statusCounts[status]}
              </span>
            </button>
          );
        })}
      </section>
      {obligations.isLoading ? <LoadingState /> : null}
      {obligations.isError ? (
        <RetryPanel error={obligations.error} onRetry={() => void obligations.refetch()} />
      ) : null}
      {obligations.isSuccess && tableItems.length === 0 ? (
        <EmptyState title="No obligations available" />
      ) : null}
      {obligations.isSuccess && tableItems.length > 0 ? (
        <ObligationTable obligations={tableItems} />
      ) : null}
    </ContentContainer>
  );
}
