/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import {
  createObligationExtractor,
  isGeminiQuotaFallbackTrigger,
  registerWorkers,
  type WorkerRuntime,
} from "../../src/bootstrap/register-workers.js";
import type { Logger } from "../../src/config/logger.js";
import { parseEnv } from "../../src/config/env.js";
import {
  GroqObligationExtractionProvider,
  HeuristicObligationExtractionProvider,
  TriggeredFallbackObligationExtractionProvider,
} from "../../src/modules/extraction/obligation-extraction.provider.js";
import { ReferenceAwareObligationExtractor } from "../../src/modules/extraction/reference-aware/index.js";
import { ExternalServiceError } from "../../src/shared/errors/external-service-error.js";

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

  it("wraps Gemini with a quota-triggered Groq fallback when both keys are configured", () => {
    const extractor = createObligationExtractor({
      env: parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_API_KEY: "test-gemini-key",
        GROQ_API_KEY: "test-groq-key",
      }),
      logger,
    });

    expect(extractor).toBeInstanceOf(TriggeredFallbackObligationExtractionProvider);
  });

  it("fails clearly when reference-aware Gemini is selected without required Gemini config", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_MODEL: "gemini-test-model",
      }),
    ).toThrow("GEMINI_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini");
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

describe("isGeminiQuotaFallbackTrigger", () => {
  it("triggers for daily and HTTP quota failures", () => {
    expect(isGeminiQuotaFallbackTrigger(new ExternalServiceError("DAILY_QUOTA_EXHAUSTED"))).toBe(
      true,
    );
    expect(
      isGeminiQuotaFallbackTrigger(
        new ExternalServiceError("Gemini structured LLM request failed", {
          status: 429,
        }),
      ),
    ).toBe(true);
  });

  it("does not trigger for non-quota Gemini failures", () => {
    expect(
      isGeminiQuotaFallbackTrigger(
        new ExternalServiceError("Gemini structured LLM request failed", {
          retryable: true,
          status: 503,
        }),
      ),
    ).toBe(false);
    expect(isGeminiQuotaFallbackTrigger(new Error("Invalid extraction response"))).toBe(false);
  });
});
