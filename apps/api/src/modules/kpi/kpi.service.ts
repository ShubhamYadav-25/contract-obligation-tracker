import type { KpiRepository } from "./kpi.repository.js";

export class KpiService {
  constructor(private readonly kpiRepository: KpiRepository) {}

  listRuns() {
    return this.kpiRepository.listRuns();
  }
}
