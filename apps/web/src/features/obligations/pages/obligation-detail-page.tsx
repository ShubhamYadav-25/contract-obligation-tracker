/**
 * @file Defines routed feature page components for the contract tracker.
 */
import { useParams } from "react-router-dom";

import { InlineError } from "@/components/feedback/inline-error.js";
import { LoadingState } from "@/components/feedback/loading-state.js";
import { RetryPanel } from "@/components/feedback/retry-panel.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Card } from "@/components/ui/card.js";
import { isConflictError } from "@/services/api-error.js";
import { formatDateTime } from "@/utils/format-date.js";
import { ObligationSourcePanel } from "../components/obligation-source-panel.js";
import { ObligationStatusBadge } from "../components/obligation-status-badge.js";
import { TransitionDialog } from "../components/transition-dialog.js";
import { TransitionHistory } from "../components/transition-history.js";
import { useObligation } from "../hooks/use-obligation.js";
import { useUpdateObligationStatus } from "../hooks/use-update-obligation-status.js";

/**
 * @description Renders the obligation detail page component for the contract tracker UI.
 * @returns {JSX.Element} Result of the obligation detail page operation.
 */
export function ObligationDetailPage() {
  const obligationId = useParams().obligationId ?? "";
  const obligation = useObligation(obligationId);
  const updateStatus = useUpdateObligationStatus(obligationId);

  return (
    <ContentContainer>
      <PageHeader
        description="Change status only through backend-approved transitions."
        title="Obligation detail"
      />
      {obligation.isLoading ? <LoadingState /> : null}
      {obligation.isError ? (
        <RetryPanel error={obligation.error} onRetry={() => void obligation.refetch()} />
      ) : null}
      {updateStatus.error && isConflictError(updateStatus.error) ? (
        <InlineError error={updateStatus.error} />
      ) : null}
      {obligation.isSuccess ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{obligation.data.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  Due {obligation.data.dueAt ? formatDateTime(obligation.data.dueAt) : "not set"}
                </p>
              </div>
              <ObligationStatusBadge status={obligation.data.status} />
            </div>
            <p className="mt-5 text-sm leading-6">{obligation.data.description}</p>
            <div className="mt-5">
              <TransitionDialog
                disabled={updateStatus.isPending}
                onSelect={(toStatus) =>
                  updateStatus.mutate({
                    obligationId: obligation.data.id,
                    toStatus,
                    expectedVersion: obligation.data.version,
                  })
                }
                status={obligation.data.status}
              />
            </div>
          </Card>
          <div className="space-y-4">
            <ObligationSourcePanel sourceText={obligation.data.sourceText} />
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Transition history</h2>
              <TransitionHistory transitions={obligation.data.transitionHistory} />
            </Card>
          </div>
        </div>
      ) : null}
    </ContentContainer>
  );
}
