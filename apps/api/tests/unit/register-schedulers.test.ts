/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import {
  registerSchedulers,
  type SchedulerRuntime,
} from "../../src/bootstrap/register-schedulers.js";
import type { Logger } from "../../src/config/logger.js";

const logger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("registerSchedulers", () => {
  it("returns and starts the reminder scheduler runtime", async () => {
    const start = vi.fn();
    const close = vi.fn();
    const runtime: SchedulerRuntime = {
      names: ["REMINDER_SCHEDULER"],
      start,
      runOnce: vi.fn(async () => 0),
      close,
    };

    const registry = registerSchedulers({
      logger,
      createRuntime: vi.fn(() => runtime),
    });

    expect(registry.names).toEqual(["REMINDER_SCHEDULER"]);
    expect(start).toHaveBeenCalledOnce();

    await registry.close();

    expect(close).toHaveBeenCalledOnce();
  });
});
