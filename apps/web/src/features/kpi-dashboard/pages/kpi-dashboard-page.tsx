import { EmptyState } from "../../../components/feedback/empty-state.js";
import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { KpiScoreboard } from "../components/kpi-scoreboard.js";
import { useLatestKpis } from "../hooks/use-latest-kpis.js";

export function KpiDashboardPage() {
  const kpis = useLatestKpis();

  return (
    <ContentContainer>
      <PageHeader
        description="Evidence-focused measurements fetched from backend KPI runs."
        title="KPI dashboard"
      />
      {kpis.isLoading ? <LoadingState /> : null}
      {kpis.isError ? <RetryPanel error={kpis.error} onRetry={() => void kpis.refetch()} /> : null}
      {kpis.isSuccess && kpis.data.length === 0 ? (
        <EmptyState title="No KPI run has been measured" />
      ) : null}
      {kpis.isSuccess && kpis.data.length > 0 ? <KpiScoreboard metrics={kpis.data} /> : null}
    </ContentContainer>
  );
}
