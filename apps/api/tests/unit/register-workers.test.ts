import { describe, expect, it, vi } from "vitest";

import {
  createObligationExtractor,
  registerWorkers,
  type WorkerRuntime,
} from "../../src/bootstrap/register-workers.js";
import type { Logger } from "../../src/config/logger.js";
import { parseEnv } from "../../src/config/env.js";
import {
  GroqObligationExtractionProvider,
  HeuristicObligationExtractionProvider,
} from "../../src/modules/extraction/obligation-extraction.provider.js";
import { ReferenceAwareObligationExtractor } from "../../src/modules/extraction/reference-aware/index.js";

const logger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("registerWorkers", () => {
  it("returns and starts the background worker runtime", async () => {
    const start = vi.fn();
    const close = vi.fn();
    const runtime: WorkerRuntime = {
      names: ["PROCESS_CONTRACT", "DELIVER_REMINDER"],
      start,
      runOnce: vi.fn(async () => 0),
      close,
    };

    const registry = registerWorkers({
      logger,
      createRuntime: vi.fn(() => runtime),
    });

    expect(registry.names).toEqual(["PROCESS_CONTRACT", "DELIVER_REMINDER"]);
    expect(start).toHaveBeenCalledOnce();

    await registry.close();

    expect(close).toHaveBeenCalledOnce();
  });
});

describe("createObligationExtractor", () => {
  it("uses Groq in auto mode when a Groq API key is configured", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({
        GROQ_API_KEY: "test-groq-key",
      }),
      logger,
    });

    expect(extractor).toBeInstanceOf(GroqObligationExtractionProvider);
  });

  it("uses heuristic in auto mode when no Groq API key is configured", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({}),
      logger,
    });

    expect(extractor).toBeInstanceOf(HeuristicObligationExtractionProvider);
  });

  it("uses heuristic when explicitly selected even if a Groq key exists", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "heuristic",
        GROQ_API_KEY: "test-groq-key",
      }),
      logger,
    });

    expect(extractor).toBeInstanceOf(HeuristicObligationExtractionProvider);
  });

  it("uses Groq when explicitly selected", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "groq",
        GROQ_API_KEY: "test-groq-key",
      }),
      logger,
    });

    expect(extractor).toBeInstanceOf(GroqObligationExtractionProvider);
  });

  it("fails clearly when Groq is explicitly selected without a key", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "groq",
      }),
    ).toThrow("GROQ_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=groq");
  });

  it("selects the reference-aware Gemini extractor only when explicitly configured", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-test-model",
      }),
      logger,
    });

    expect(extractor).toBeInstanceOf(ReferenceAwareObligationExtractor);
  });

  it("fails clearly when reference-aware Gemini is selected without required Gemini config", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_MODEL: "gemini-test-model",
      }),
    ).toThrow(
      "GEMINI_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini",
    );
    expect(() =>
      createObligationExtractor({
        env: parseEnv({
          OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
          GEMINI_API_KEY: "test-key",
        }),
        logger,
      }),
    ).not.toThrow();
  });
});
