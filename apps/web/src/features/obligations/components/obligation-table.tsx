import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { Table } from "@/components/ui/table.js";
import { formatDateTime } from "@/utils/format-date.js";
import { ObligationStatusBadge } from "./obligation-status-badge.js";
import type { ObligationSummary } from "../types/obligation.js";

export function ObligationTable({
  obligations,
}: {
  readonly obligations: readonly ObligationSummary[];
}) {
  return (
    <Table>
      <thead className="bg-surface text-xs uppercase text-muted">
        <tr>
          <th className="px-4 py-3">Obligation</th>
          <th className="px-4 py-3">Due</th>
          <th className="px-4 py-3">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {obligations.map((obligation) => (
          <tr key={obligation.id}>
            <td className="px-4 py-3">
              <Link
                className="font-medium hover:text-teal-800"
                to={routePaths.obligationDetail(obligation.id)}
              >
                {obligation.title}
              </Link>
            </td>
            <td className="px-4 py-3">
              {obligation.dueAt ? formatDateTime(obligation.dueAt) : "Not set"}
            </td>
            <td className="px-4 py-3">
              <ObligationStatusBadge status={obligation.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
