import type { KpiRunSummary } from "./kpi.types.js";

export interface KpiRepository {
  listRuns(): Promise<readonly KpiRunSummary[]>;
  findRunById(id: string): Promise<KpiRunSummary | null>;
}
