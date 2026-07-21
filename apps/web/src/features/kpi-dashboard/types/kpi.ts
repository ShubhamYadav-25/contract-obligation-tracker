export type KpiStatus = "PASS" | "WARN" | "FAIL" | "NOT_MEASURED";

export interface KpiMetric {
  readonly kpi: string;
  readonly target: string;
  readonly actual?: string | undefined;
  readonly status: KpiStatus;
  readonly sampleSize?: number | undefined;
  readonly measurementMethod: string;
  readonly measuredAt?: string | undefined;
}
