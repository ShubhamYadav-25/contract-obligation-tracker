import { describe, expect, it } from "vitest";

import {
  PermanentJobError,
  RetryableJobError,
  getRetryDelayMilliseconds,
  isRetryableJobError,
} from "../../src/jobs/retry-policy.js";

describe("retry policy", () => {
  it("uses bounded exponential backoff", () => {
    expect(
      getRetryDelayMilliseconds({
        attemptCount: 1,
        baseDelayMilliseconds: 1_000,
        maxDelayMilliseconds: 10_000,
      }),
    ).toBe(1_000);
    expect(
      getRetryDelayMilliseconds({
        attemptCount: 5,
        baseDelayMilliseconds: 1_000,
        maxDelayMilliseconds: 10_000,
      }),
    ).toBe(10_000);
  });

  it("classifies permanent and retryable errors explicitly", () => {
    expect(isRetryableJobError(new RetryableJobError("temporary"))).toBe(true);
    expect(isRetryableJobError(new PermanentJobError("invalid payload"))).toBe(false);
    expect(isRetryableJobError(new Error("default retryable"))).toBe(true);
  });
});
