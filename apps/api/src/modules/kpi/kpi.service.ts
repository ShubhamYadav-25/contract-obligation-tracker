/**
 * @file Defines backend kpi module contracts, services, routes, or persistence logic.
 */
import type { KpiRepository } from "./kpi.repository.js";

export class KpiService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {KpiRepository} kpiRepository - Input value for kpi repository.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly kpiRepository: KpiRepository) {}

  /**
   * @description Executes the list runs operation used by the application workflow.
   * @returns {unknown} Result of the list runs operation.
   */
  listRuns() {
    return this.kpiRepository.listRuns();
  }
}
