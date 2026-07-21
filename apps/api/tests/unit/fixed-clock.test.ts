import { describe, expect, it } from "vitest";

class FixedClock {
  #now: Date;

  constructor(now: Date | string) {
    this.#now = new Date(now);
  }

  now(): Date {
    return new Date(this.#now);
  }

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
