/**
 * @file Defines backend kpi module contracts, services, routes, or persistence logic.
 */
import type { KpiRunSummary } from "./kpi.types.js";

export interface KpiRepository {
  listRuns(): Promise<readonly KpiRunSummary[]>;
  findRunById(id: string): Promise<KpiRunSummary | null>;
}
