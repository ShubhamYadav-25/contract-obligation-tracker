/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { Card } from "@/components/ui/card.js";
import { formatDateTime } from "@/utils/format-date.js";
import { ObligationStatusBadge } from "./obligation-status-badge.js";
import type { ObligationSummary } from "../types/obligation.js";

/**
 * @description Renders the obligation card component for the contract tracker UI.
 * @param {{ readonly obligation: ObligationSummary }} { obligation } - Input value for { obligation }.
 * @returns {JSX.Element} Result of the obligation card operation.
 */
export function ObligationCard({ obligation }: { readonly obligation: ObligationSummary }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            className="font-semibold hover:text-teal-800"
            to={routePaths.obligationDetail(obligation.id)}
          >
            {obligation.title}
          </Link>
          <p className="mt-1 text-sm text-muted">
            Due {obligation.dueAt ? formatDateTime(obligation.dueAt) : "not set"}
          </p>
        </div>
        <ObligationStatusBadge status={obligation.status} />
      </div>
    </Card>
  );
}
