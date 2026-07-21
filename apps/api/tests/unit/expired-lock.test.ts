import { describe, expect, it } from "vitest";

import { hasExpiredProcessingLease } from "../../src/jobs/recovery/expired-lock.js";
import type { BackgroundJob } from "../../src/jobs/job.types.js";

const baseJob: BackgroundJob = {
  id: "job-1",
  jobType: "PROCESS_CONTRACT",
  idempotencyKey: "contract:1:process:1",
  payload: {},
  status: "PROCESSING",
  priority: 0,
  availableAt: new Date("2026-07-20T10:00:00.000Z"),
  attemptCount: 1,
  maxAttempts: 5,
  createdAt: new Date("2026-07-20T10:00:00.000Z"),
  updatedAt: new Date("2026-07-20T10:00:00.000Z"),
};

describe("expired lease detection", () => {
  it("detects expired processing leases", () => {
    expect(
      hasExpiredProcessingLease(
        { ...baseJob, lockExpiresAt: new Date("2026-07-20T10:01:00.000Z") },
        new Date("2026-07-20T10:02:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not mark non-processing jobs as expired", () => {
    expect(
      hasExpiredProcessingLease(
        {
          ...baseJob,
          status: "PENDING",
          lockExpiresAt: new Date("2026-07-20T10:01:00.000Z"),
        },
        new Date("2026-07-20T10:02:00.000Z"),
      ),
    ).toBe(false);
  });
});
