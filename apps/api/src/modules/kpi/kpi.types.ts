export interface KpiRunSummary {
  readonly id: string;
  readonly name: string;
  readonly status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}
