import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { LoadingState } from "@/components/feedback/loading-state.js";
import { EmptyState } from "@/features/workflow/components.js";
import { ReviewCandidateCard } from "../components/review-candidate-card.js";
import { useReviewCandidates } from "../hooks/use-review-candidates.js";

export function ReviewQueuePage() {
  const candidates = useReviewCandidates();
  return (
    <ContentContainer>
      <PageHeader
        description="Verify low-confidence extraction candidates before they become obligations."
        title="Review Queue"
      />
      {candidates.isLoading ? <LoadingState label="Loading review queue" /> : null}
      {candidates.isError ? <InlineError error={candidates.error} /> : null}
      {candidates.isSuccess && candidates.data.length === 0 ? (
        <EmptyState title="The review queue is clear.">
          New extraction candidates requiring confirmation will appear here.
        </EmptyState>
      ) : null}
      {candidates.isSuccess && candidates.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {candidates.data.map((candidate) => (
            <ReviewCandidateCard candidate={candidate} key={candidate.id} />
          ))}
        </div>
      ) : null}
    </ContentContainer>
  );
}
