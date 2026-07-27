import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { LoadingState } from "@/components/feedback/loading-state.js";
import { Card } from "@/components/ui/card.js";
import { routePaths } from "@/app/route-paths.js";
import { ReviewForm } from "../components/review-form.js";
import { ReviewReasonList } from "../components/review-reason-list.js";
import { SourceEvidencePanel } from "../components/source-evidence-panel.js";
import { useReviewCandidate } from "../hooks/use-review-candidate.js";
import { approveReviewCandidate } from "../api/approve-review-candidate.js";
import { rejectReviewCandidate } from "../api/reject-review-candidate.js";

export function ReviewDetailPage() {
  const candidateId = useParams().candidateId ?? "";
  const candidate = useReviewCandidate(candidateId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const decision = useMutation({
    mutationFn: (input: { type: "approve"; values: any } | { type: "reject"; reason: string }) =>
      input.type === "approve"
        ? approveReviewCandidate(candidateId, input.values)
        : rejectReviewCandidate(candidateId, input.reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
      navigate(routePaths.reviews);
    },
  });

  return (
    <ContentContainer>
      <PageHeader description="Confirm or reject extracted contract information." title="Review Candidate" />
      {candidate.isLoading ? <LoadingState label="Loading candidate" /> : null}
      {candidate.isError ? <InlineError error={candidate.error} /> : null}
      {decision.isError ? <InlineError error={decision.error} /> : null}
      {candidate.isSuccess ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
          <Card>
            <ReviewForm
              defaultValues={{
                title: candidate.data.title,
                description: candidate.data.description,
                reason: "",
              }}
              disabled={decision.isPending}
              onApprove={(values) => decision.mutate({ type: "approve", values })}
              onReject={(reason) => decision.mutate({ type: "reject", reason })}
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
