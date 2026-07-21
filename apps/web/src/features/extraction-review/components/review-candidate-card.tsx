import { Link } from "react-router-dom";

import { routePaths } from "../../../app/route-paths.js";
import { Card } from "../../../components/ui/card.js";
import { ConfidenceIndicator } from "./confidence-indicator.js";
import type { ReviewCandidate } from "../types/review-candidate.js";

export function ReviewCandidateCard({ candidate }: { readonly candidate: ReviewCandidate }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            className="text-base font-semibold hover:text-teal-800"
            to={routePaths.reviewDetail(candidate.id)}
          >
            {candidate.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{candidate.description}</p>
        </div>
        <ConfidenceIndicator confidence={candidate.confidence} />
      </div>
    </Card>
  );
}
