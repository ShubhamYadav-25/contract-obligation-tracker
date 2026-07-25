/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { JobRunner } from "../job-runner.js";

export class JobPoller {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {JobRunner} runner - Input value for runner.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly runner: JobRunner) {}

  /**
   * @description Implements the poll method for this service or adapter.
   * @returns {Promise<number>} Result of the poll operation.
   */
  poll(): Promise<number> {
    return this.runner.runOnce();
  }
}
