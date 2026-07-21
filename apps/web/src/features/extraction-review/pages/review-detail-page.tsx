import { useParams } from "react-router-dom";

import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { Card } from "../../../components/ui/card.js";
import { ReviewForm } from "../components/review-form.js";
import { ReviewReasonList } from "../components/review-reason-list.js";
import { SourceEvidencePanel } from "../components/source-evidence-panel.js";
import { useReviewCandidate } from "../hooks/use-review-candidate.js";

export function ReviewDetailPage() {
  const candidateId = useParams().candidateId ?? "";
  const candidate = useReviewCandidate(candidateId);

  return (
    <ContentContainer>
      <PageHeader
        description="Validate extracted values against source evidence before approval."
        title="Review detail"
      />
      {candidate.isLoading ? <LoadingState /> : null}
      {candidate.isError ? (
        <RetryPanel error={candidate.error} onRetry={() => void candidate.refetch()} />
      ) : null}
      {candidate.isSuccess ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <Card>
            <ReviewForm
              defaultValues={{
                title: candidate.data.title,
                description: candidate.data.description,
              }}
              onApprove={() => undefined}
              onReject={() => undefined}
            />
          </Card>
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Review reasons</h2>
              <ReviewReasonList reasons={candidate.data.reviewReasons} />
            </Card>
            <SourceEvidencePanel anchors={candidate.data.sourceAnchors} />
          </div>
        </div>
      ) : null}
    </ContentContainer>
  );
}
