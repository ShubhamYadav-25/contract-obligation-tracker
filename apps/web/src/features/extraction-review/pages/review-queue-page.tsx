import { EmptyState } from "../../../components/feedback/empty-state.js";
import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { ReviewCandidateCard } from "../components/review-candidate-card.js";
import { useReviewCandidates } from "../hooks/use-review-candidates.js";

export function ReviewQueuePage() {
  const candidates = useReviewCandidates();

  return (
    <ContentContainer>
      <PageHeader
        description="Inspect model candidates before obligations become active."
        title="Extraction review"
      />
      {candidates.isLoading ? <LoadingState /> : null}
      {candidates.isError ? (
        <RetryPanel error={candidates.error} onRetry={() => void candidates.refetch()} />
      ) : null}
      {candidates.isSuccess && candidates.data.length === 0 ? (
        <EmptyState title="No candidates pending review" />
      ) : null}
      {candidates.isSuccess && candidates.data.length > 0 ? (
        <div className="space-y-4">
          {candidates.data.map((candidate) => (
            <ReviewCandidateCard candidate={candidate} key={candidate.id} />
          ))}
        </div>
      ) : null}
    </ContentContainer>
  );
}
