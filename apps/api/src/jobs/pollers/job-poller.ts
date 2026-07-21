import type { JobRunner } from "../job-runner.js";

export class JobPoller {
  constructor(private readonly runner: JobRunner) {}

  poll(): Promise<number> {
    return this.runner.runOnce();
  }
}
