/**
 * @file Defines reusable test helpers, fixtures, and mock providers.
 */
export interface KpiReportMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly threshold?: number;
}

export interface KpiReportSummary {
  readonly generatedAt: string;
  readonly datasetName: string;
  readonly sampleCount: number;
}

export interface KpiReport {
  readonly summary: KpiReportSummary;
  readonly metrics: readonly KpiReportMetric[];
}
