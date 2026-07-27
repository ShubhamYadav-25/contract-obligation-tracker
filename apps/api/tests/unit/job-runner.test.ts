import { afterEach, describe, expect, it, vi } from "vitest";

import type { JobConfig } from "../../src/config/jobs.js";
import type { Logger } from "../../src/config/logger.js";
import type { Clock } from "../../src/infrastructure/clock/clock.js";
import { JobRunner } from "../../src/jobs/job-runner.js";
import type { JobRepository } from "../../src/jobs/job.repository.js";
import type { BackgroundJob } from "../../src/jobs/job.types.js";
import { ProcessorRegistry } from "../../src/jobs/processors/processor-registry.js";

const activeJob: BackgroundJob = {
  id: "job-1",
  jobType: "PROCESS_CONTRACT",
  idempotencyKey: "contract-processing:document-1:run-1",
  payload: {},
  status: "PROCESSING",
  priority: 0,
  availableAt: new Date(),
  attemptCount: 1,
  maxAttempts: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const config: JobConfig = {
  workerId: "worker-1",
  pollIntervalMilliseconds: 100,
  batchSize: 1,
  lockDurationMilliseconds: 3_000,
  maxAttempts: 5,
  retryBaseDelayMilliseconds: 100,
  retryMaxDelayMilliseconds: 1_000,
};

const logger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

afterEach(() => {
  vi.useRealTimers();
});

describe("JobRunner lease heartbeat", () => {
  it("renews the job lock while a processor is still running", async () => {
    vi.useFakeTimers();
    let finishProcessing: (() => void) | undefined;
    const processing = new Promise<void>((resolve) => {
      finishProcessing = resolve;
    });
    const renewLock = vi.fn(async () => true);
    const jobs = {
      recoverExpiredJobs: vi.fn(async () => []),
      claimJobs: vi.fn(async () => [activeJob]),
      renewLock,
      markCompleted: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
      createJob: vi.fn(),
    } satisfies JobRepository;
    const runner = new JobRunner(
      jobs,
      new ProcessorRegistry(new Map([["PROCESS_CONTRACT", async () => processing]])),
      config,
      { now: () => new Date("2026-07-27T15:00:00.000Z") } satisfies Clock,
      logger,
    );

    const run = runner.runOnce();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(renewLock).toHaveBeenCalledWith({
      jobId: activeJob.id,
      workerId: config.workerId,
      lockDurationMilliseconds: config.lockDurationMilliseconds,
    });

    finishProcessing?.();
    await run;
    const renewalCount = renewLock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(renewLock).toHaveBeenCalledTimes(renewalCount);
  });
});
