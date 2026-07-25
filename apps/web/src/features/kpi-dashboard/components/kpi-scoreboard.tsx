/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Table } from "@/components/ui/table.js";
import { formatDateTime } from "@/utils/format-date.js";
import { KpiStatusBadge } from "./kpi-status-badge.js";
import type { KpiMetric } from "../types/kpi.js";

/**
 * @description Renders the kpi scoreboard component for the contract tracker UI.
 * @param {{ readonly metrics: readonly KpiMetric[] }} { metrics } - Input value for { metrics }.
 * @returns {JSX.Element} Result of the kpi scoreboard operation.
 */
export function KpiScoreboard({ metrics }: { readonly metrics: readonly KpiMetric[] }) {
  return (
    <Table>
      <thead className="bg-surface text-xs uppercase text-muted">
        <tr>
          <th className="px-4 py-3">KPI</th>
          <th className="px-4 py-3">Target</th>
          <th className="px-4 py-3">Actual</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Sample size</th>
          <th className="px-4 py-3">Measurement method</th>
          <th className="px-4 py-3">Measured at</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {metrics.map((metric) => (
          <tr key={metric.kpi}>
            <td className="px-4 py-3 font-medium">{metric.kpi}</td>
            <td className="px-4 py-3">{metric.target}</td>
            <td className="px-4 py-3">{metric.actual ?? "Not measured"}</td>
            <td className="px-4 py-3">
              <KpiStatusBadge status={metric.status} />
            </td>
            <td className="px-4 py-3">{metric.sampleSize ?? "Not measured"}</td>
            <td className="px-4 py-3">{metric.measurementMethod}</td>
            <td className="px-4 py-3">
              {metric.measuredAt ? formatDateTime(metric.measuredAt) : "Not measured"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
