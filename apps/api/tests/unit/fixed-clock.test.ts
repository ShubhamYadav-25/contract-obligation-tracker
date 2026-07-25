/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

class FixedClock {
  #now: Date;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Date | string} now - Input value for now.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(now: Date | string) {
    this.#now = new Date(now);
  }

  /**
   * @description Implements the now method for this service or adapter.
   * @returns {Date} Result of the now operation.
   */
  now(): Date {
    return new Date(this.#now);
  }

  /**
   * @description Implements the advance by method for this service or adapter.
   * @param {number} milliseconds - Input value for milliseconds.
   * @returns {Date} Result of the advance by operation.
   */
  advanceBy(milliseconds: number): Date {
    this.#now = new Date(this.#now.getTime() + milliseconds);
    return this.now();
  }
}

describe("fixed clock", () => {
  it("returns and advances deterministic time", () => {
    const clock = new FixedClock("2026-07-20T00:00:00.000Z");

    expect(clock.now().toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(clock.advanceBy(60_000).toISOString()).toBe("2026-07-20T00:01:00.000Z");
  });
});
