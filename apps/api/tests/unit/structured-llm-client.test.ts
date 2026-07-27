/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Logger } from "../../src/config/logger.js";
import { FakeStructuredLlmClient } from "../../src/infrastructure/llm/fake-structured-llm-client.js";
import {
  DEFAULT_FREE_MODEL_CANDIDATES,
  GeminiStructuredLlmClient,
  normalizeGeminiModelName,
  parseGeminiQuotaError,
  supportsGenerateContent,
} from "../../src/infrastructure/llm/gemini-structured-llm.client.js";
import { ExternalServiceError } from "../../src/shared/errors/external-service-error.js";

const responseSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
};

const validator = z.object({
  ok: z.boolean(),
});

/**
 * @description Performs the logger helper operation for this module.
 * @returns {Logger} Result of the logger operation.
 */
function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * @description Performs the env helper operation for this module.
 * @param {Partial<ConstructorParameters<typeof GeminiStructuredLlmClient>[0]["env"]>} overrides - Input value for overrides.
 * @returns {unknown} Result of the env operation.
 */
function env(
  overrides: Partial<ConstructorParameters<typeof GeminiStructuredLlmClient>[0]["env"]> = {},
) {
  return {
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: undefined,
    GEMINI_REQUEST_TIMEOUT_MS: 1_000,
    GEMINI_MAX_ATTEMPTS: 2,
    GEMINI_MAX_REQUESTS_PER_CONTRACT: 8,
    GEMINI_MIN_REQUEST_INTERVAL_MS: 0,
    GEMINI_MAX_QUOTA_RETRIES: 2,
    GEMINI_MAX_RETRY_DELAY_MS: 120_000,
    GEMINI_MAX_BATCH_OUTPUT_TOKENS: 6_000,
    ...overrides,
  };
}

/**
 * @description Performs the setup gemini helper operation for this module.
 * @param {{ readonly listModels?: ReturnType<typeof vi.fn>; readonly generateContent?: ReturnType<typeof vi.fn>; readonly overrideEnv?: Partial<ConstructorParameters<typeof GeminiStructuredLlmClient>[0]["env"]>; readonly modelCandidates?: readonly string[]; }} input - Input value for input.
 * @returns {unknown} Result of the setup gemini operation.
 */
function setupGemini(input: {
  readonly listModels?: ReturnType<typeof vi.fn>;
  readonly generateContent?: ReturnType<typeof vi.fn>;
  readonly overrideEnv?: Partial<ConstructorParameters<typeof GeminiStructuredLlmClient>[0]["env"]>;
  readonly modelCandidates?: readonly string[];
}) {
  const constructorCalls: unknown[] = [];
  const testLogger = logger();
  class FakeGoogleGenAI {
    readonly models = {
      list:
        input.listModels ??
        vi.fn(async () => ({
          models: [
            {
              name: "models/gemini-3.5-flash-lite",
              supportedActions: ["generateContent"],
            },
          ],
        })),
      generateContent:
        input.generateContent ??
        vi.fn(async () => ({
          text: JSON.stringify({ status: "OK" }),
        })),
    };

    /**
     * @description Implements the constructor method for this service or adapter.
     * @param {unknown} config - Input value for config.
     * @returns {unknown} Result of the constructor operation.
     */
    constructor(config: unknown) {
      constructorCalls.push(config);
    }
  }

  const client = new GeminiStructuredLlmClient({
    env: env(input.overrideEnv),
    logger: testLogger,
    delay: async () => {},
    ...(input.modelCandidates ? { modelCandidates: input.modelCandidates } : {}),
    sdkLoader: async () => ({
      GoogleGenAI: FakeGoogleGenAI,
    }),
  });

  return {
    client,
    constructorCalls,
    logger: testLogger,
  };
}

describe("Gemini model discovery", () => {
  it("parses RetryInfo and QuotaFailure details from sanitized 429 errors", () => {
    const quota = parseGeminiQuotaError({
      operation: "obligation_candidate_extraction",
      model: "gemini-3.5-flash-lite",
      error: {
        status: 429,
        message: JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Quota exceeded for generate_content requests per minute.",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                violations: [
                  {
                    quotaMetric:
                      "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                    quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
                    quotaDimensions: {
                      model: "gemini-3.5-flash-lite",
                      region: "global",
                    },
                  },
                ],
              },
              {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                retryDelay: "17s",
              },
            ],
          },
        }),
      },
    });

    expect(quota).toMatchObject({
      category: "REQUESTS_PER_MINUTE",
      retryable: true,
      retryAfterMilliseconds: 17_000,
      quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
      quotaDimensions: { model: "gemini-3.5-flash-lite", region: "global" },
    });
  });

  it("classifies daily quota as non-retryable", () => {
    const quota = parseGeminiQuotaError({
      operation: "obligation_candidate_extraction",
      model: "gemini-3.5-flash-lite",
      error: {
        status: 429,
        message: JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Daily quota exhausted.",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                violations: [
                  {
                    quotaMetric:
                      "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                    quotaId: "GenerateRequestsPerDayPerProject-FreeTier",
                  },
                ],
              },
            ],
          },
        }),
      },
    });

    expect(quota).toMatchObject({
      category: "REQUESTS_PER_DAY",
      retryable: false,
    });
  });

  it("uses SDK supportedActions as the primary generateContent capability field", () => {
    expect(supportsGenerateContent({ supportedActions: ["generateContent"] })).toBe(true);
    expect(supportsGenerateContent({ supportedActions: ["embedContent"] })).toBe(false);
    expect(supportsGenerateContent({ supportedActions: ["GENERATECONTENT"] })).toBe(true);
    expect(supportsGenerateContent({ supportedActions: undefined })).toBeNull();
    expect(supportsGenerateContent({ supportedGenerationMethods: ["generateContent"] })).toBe(true);
  });

  it("normalizes optional models/ prefixes", () => {
    expect(normalizeGeminiModelName("models/gemini-3.5-flash-lite")).toBe("gemini-3.5-flash-lite");
  });

  it("selects the first successful default candidate when GEMINI_MODEL is absent", async () => {
    const generateContent = vi.fn(async () => ({ text: JSON.stringify({ status: "OK" }) }));
    const { client } = setupGemini({ generateContent });

    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: DEFAULT_FREE_MODEL_CANDIDATES[0],
      selectionSource: "LISTED_CANDIDATE",
    });
  });

  it("attempts the configured model first and removes duplicate candidate names", async () => {
    const generateContent = vi.fn(async () => ({ text: JSON.stringify({ status: "OK" }) }));
    const { client } = setupGemini({
      generateContent,
      overrideEnv: { GEMINI_MODEL: "models/gemini-3.1-flash-lite" },
      modelCandidates: ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"],
    });

    expect(client.getCandidateModels()).toEqual(["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]);
    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: "gemini-3.1-flash-lite",
      selectionSource: "CONFIGURED_MODEL",
    });
  });

  it("does not reject listed candidates when supportedActions is missing", async () => {
    const listModels = vi.fn(async () => ({
      models: [{ name: "models/gemini-3.5-flash-lite" }],
    }));
    const { client } = setupGemini({ listModels });

    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: "gemini-3.5-flash-lite",
    });
  });

  it("does not convert list authentication or network errors into empty model lists", async () => {
    const authList = vi.fn(async () => {
      throw { status: 400, message: "API_KEY_INVALID" };
    });
    await expect(
      setupGemini({ listModels: authList }).client.selectUsableModel(),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ status: 400 }),
    });

    const networkList = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    await expect(
      setupGemini({ listModels: networkList }).client.selectUsableModel(),
    ).rejects.toThrow();
  });

  it("continues with direct preflight when model listing succeeds with an empty result", async () => {
    const listModels = vi.fn(async () => ({ models: [] }));
    const generateContent = vi.fn(async () => ({ text: JSON.stringify({ status: "OK" }) }));
    const { client } = setupGemini({ listModels, generateContent });

    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: "gemini-3.5-flash-lite",
      selectionSource: "DIRECT_PREFLIGHT",
    });
  });

  it("moves to the next candidate after 404 or structured schema failure", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce({ status: 404, message: "not found" })
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "OK" }) });
    const { client } = setupGemini({
      generateContent,
      modelCandidates: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
    });

    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: "gemini-3.1-flash-lite",
    });

    const schemaFailure = vi
      .fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "NO" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "OK" }) });
    await expect(
      setupGemini({
        generateContent: schemaFailure,
        modelCandidates: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
      }).client.selectUsableModel(),
    ).resolves.toMatchObject({
      selectedModel: "gemini-3.1-flash-lite",
    });
  });

  it("stops immediately on candidate authentication failure", async () => {
    const generateContent = vi.fn(async () => {
      throw { status: 400, message: "API_KEY_INVALID" };
    });

    await expect(setupGemini({ generateContent }).client.selectUsableModel()).rejects.toMatchObject(
      {
        details: expect.objectContaining({ status: 400 }),
      },
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries 429 according to configured retry settings", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce({ status: 429, message: "rate limited" })
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "OK" }) });
    const { client } = setupGemini({ generateContent });

    await expect(client.selectUsableModel()).resolves.toMatchObject({
      selectedModel: "gemini-3.5-flash-lite",
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(client.getMetricsSnapshot().retryCount).toBe(1);
  });

  it("rejects a Gemini SDK promise that ignores abort signals at the hard deadline", async () => {
    const generateContent = vi.fn(() => new Promise<never>(() => {}));
    const { client } = setupGemini({
      generateContent,
      overrideEnv: {
        GEMINI_MODEL: "gemini-3.5-flash-lite",
        GEMINI_REQUEST_TIMEOUT_MS: 10,
        GEMINI_MAX_ATTEMPTS: 1,
      },
    });

    await expect(client.selectUsableModel()).rejects.toMatchObject({
      message: "Gemini structured LLM request failed",
      details: expect.objectContaining({
        attempts: 1,
        message: expect.stringContaining("timed out after 10ms"),
        retryable: true,
      }),
    });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it("stops immediately on daily quota exhaustion", async () => {
    const generateContent = vi.fn(async () => {
      throw {
        status: 429,
        message: JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Daily quota exhausted.",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                violations: [{ quotaId: "GenerateRequestsPerDayPerProject-FreeTier" }],
              },
            ],
          },
        }),
      };
    });

    await expect(setupGemini({ generateContent }).client.selectUsableModel()).rejects.toMatchObject(
      {
        message: "DAILY_QUOTA_EXHAUSTED",
        details: expect.objectContaining({
          quota: expect.objectContaining({ category: "REQUESTS_PER_DAY" }),
        }),
      },
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("enforces a shared request budget", async () => {
    const { client } = setupGemini({
      overrideEnv: { GEMINI_MAX_REQUESTS_PER_CONTRACT: 1 },
    });

    await expect(client.selectUsableModel()).rejects.toMatchObject({
      message: "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED",
      details: expect.objectContaining({
        code: "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED",
      }),
    });
  });

  it("resets request budget counters for a new contract scope", async () => {
    const { client } = setupGemini({
      overrideEnv: { GEMINI_MAX_REQUESTS_PER_CONTRACT: 1 },
    });

    await expect(client.selectUsableModel()).rejects.toMatchObject({
      message: "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED",
    });

    expect(client.getMetricsSnapshot().requestCount).toBe(1);
    client.resetRequestBudgetScope();
    expect(client.getMetricsSnapshot().requestCount).toBe(0);
  });

  it("enforces request spacing through the shared limiter", async () => {
    const delays: number[] = [];
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "OK" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
    const testLogger = logger();
    class FakeGoogleGenAI {
      readonly models = {
        list: vi.fn(async () => ({
          models: [{ name: "models/gemini-3.5-flash-lite", supportedActions: ["generateContent"] }],
        })),
        generateContent,
      };

      /**
       * @description Implements the constructor method for this service or adapter.
       * @param {unknown} _config - Input value for config.
       * @returns {unknown} Result of the constructor operation.
       */
      constructor(_config: unknown) {}
    }
    const client = new GeminiStructuredLlmClient({
      env: env({ GEMINI_MIN_REQUEST_INTERVAL_MS: 50 }),
      logger: testLogger,
      delay: async (milliseconds) => {
        delays.push(milliseconds);
      },
      sdkLoader: async () => ({ GoogleGenAI: FakeGoogleGenAI }),
    });

    await client.selectUsableModel();
    await client.generateStructured({
      operationName: "unit_test_operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return ok.",
      jsonSchema: responseSchema,
      validator,
    });

    expect(delays.some((milliseconds) => milliseconds > 0)).toBe(true);
  });

  it("caches the selected model and reuses it for subsequent extraction calls", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ status: "OK" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
    const { client } = setupGemini({ generateContent });

    await client.selectUsableModel();
    expect(client.getSelectedModel()).toBe("gemini-3.5-flash-lite");

    await client.generateStructured({
      operationName: "unit_test_operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return ok.",
      jsonSchema: responseSchema,
      validator,
    });
    await client.generateStructured({
      operationName: "unit_test_operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return ok again.",
      jsonSchema: responseSchema,
      validator,
    });

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent.mock.calls[1]?.[0]).toMatchObject({ model: "gemini-3.5-flash-lite" });
    expect(generateContent.mock.calls[2]?.[0]).toMatchObject({ model: "gemini-3.5-flash-lite" });
  });

  it("passes only the explicit GEMINI_API_KEY to the SDK and redacts it from diagnostics", async () => {
    const generateContent = vi.fn(async () => {
      throw { status: 400, message: "API_KEY_INVALID test-gemini-key" };
    });
    const {
      client,
      constructorCalls,
      logger: testLogger,
    } = setupGemini({
      generateContent,
      overrideEnv: { GOOGLE_API_KEY: "google-key" },
    });

    await expect(client.selectUsableModel()).rejects.toMatchObject({
      details: expect.objectContaining({ message: "API_KEY_INVALID [REDACTED]" }),
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(constructorCalls).toEqual([{ apiKey: "test-gemini-key" }]);
    expect(JSON.stringify((testLogger.warn as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(
      "test-gemini-key",
    );
  });

  it("records fake client prompts by operation name without network access", async () => {
    const client = new FakeStructuredLlmClient();
    client.queueResponse("fake_operation", { ok: true });

    const result = await client.generateStructured({
      operationName: "fake_operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return ok.",
      jsonSchema: responseSchema,
      validator,
    });

    expect(result).toEqual({ ok: true });
    expect(client.prompts).toEqual([
      {
        operationName: "fake_operation",
        systemInstruction: "Return JSON only.",
        prompt: "Return ok.",
        jsonSchema: responseSchema,
      },
    ]);
  });

  it("rejects missing Gemini API key", () => {
    expect(
      () =>
        new GeminiStructuredLlmClient({
          env: env({ GEMINI_API_KEY: undefined }),
          logger: logger(),
        }),
    ).toThrow(ExternalServiceError);
  });
});
