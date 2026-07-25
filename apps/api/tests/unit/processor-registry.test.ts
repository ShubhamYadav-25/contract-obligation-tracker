/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import { ProcessorRegistry } from "../../src/jobs/processors/processor-registry.js";

describe("ProcessorRegistry", () => {
  it("returns registered processors", () => {
    const processor = vi.fn();
    const registry = new ProcessorRegistry(new Map([["PROCESS_CONTRACT", processor]]));

    expect(registry.get("PROCESS_CONTRACT")).toBe(processor);
  });

  it("rejects unsupported job types", () => {
    const registry = new ProcessorRegistry(new Map());

    expect(() => registry.get("UNKNOWN_JOB")).toThrow("Unsupported job type");
  });
});
