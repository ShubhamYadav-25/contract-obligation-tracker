import { describe, expect, it, vi } from "vitest";

import { registerWorkers, type WorkerRuntime } from "../../src/bootstrap/register-workers.js";
import type { Logger } from "../../src/config/logger.js";

const logger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("registerWorkers", () => {
  it("returns and starts the contract-processing worker runtime", async () => {
    const start = vi.fn();
    const close = vi.fn();
    const runtime: WorkerRuntime = {
      names: ["PROCESS_CONTRACT"],
      start,
      close,
    };

    const registry = registerWorkers({
      logger,
      createRuntime: vi.fn(() => runtime),
    });

    expect(registry.names).toEqual(["PROCESS_CONTRACT"]);
    expect(start).toHaveBeenCalledOnce();

    await registry.close();

    expect(close).toHaveBeenCalledOnce();
  });
});
