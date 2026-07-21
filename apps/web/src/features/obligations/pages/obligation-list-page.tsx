import { EmptyState } from "../../../components/feedback/empty-state.js";
import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { ObligationTable } from "../components/obligation-table.js";
import { useObligations } from "../hooks/use-obligations.js";

export function ObligationListPage() {
  const obligations = useObligations();

  return (
    <ContentContainer>
      <PageHeader
        description="Track due dates and authoritative obligation states."
        title="Obligations"
      />
      {obligations.isLoading ? <LoadingState /> : null}
      {obligations.isError ? (
        <RetryPanel error={obligations.error} onRetry={() => void obligations.refetch()} />
      ) : null}
      {obligations.isSuccess && obligations.data.length === 0 ? (
        <EmptyState title="No obligations available" />
      ) : null}
      {obligations.isSuccess && obligations.data.length > 0 ? (
        <ObligationTable obligations={obligations.data} />
      ) : null}
    </ContentContainer>
  );
}
