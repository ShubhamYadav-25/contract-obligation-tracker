/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import { parseEnv } from "../../src/config/env.js";
import {
  buildGeminiConfigurationDiagnostic,
  runGeminiDoctor,
} from "../../src/scripts/gemini-doctor.js";

/**
 * @description Performs the now helper operation for this module.
 * @returns {unknown} Result of the now operation.
 */
const now = () => new Date("2026-07-24T00:00:00.000Z");

/**
 * @description Performs the env helper operation for this module.
 * @param {Record<string, string | undefined>} overrides - Input value for overrides.
 * @returns {unknown} Result of the env operation.
 */
function env(overrides: Record<string, string | undefined> = {}) {
  return parseEnv({
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_REQUEST_TIMEOUT_MS: "1000",
    GEMINI_MAX_ATTEMPTS: "1",
    GEMINI_MIN_REQUEST_INTERVAL_MS: "0",
    ...overrides,
  });
}

/**
 * @description Performs the sdk helper operation for this module.
 * @param {{ readonly list?: ReturnType<typeof vi.fn>; readonly generateContent?: ReturnType<typeof vi.fn>; }} input - Input value for input.
 * @returns {unknown} Result of the sdk operation.
 */
function sdk(input: {
  readonly list?: ReturnType<typeof vi.fn>;
  readonly generateContent?: ReturnType<typeof vi.fn>;
}) {
  class FakeGoogleGenAI {
    readonly models = {
      list:
        input.list ??
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
  }

  return async () => ({
    GoogleGenAI: FakeGoogleGenAI,
  });
}

describe("gemini doctor", () => {
  it("reports sanitized automatic configuration", () => {
    const diagnostic = buildGeminiConfigurationDiagnostic(
      env({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GOOGLE_API_KEY: "google-key",
      }),
    );

    expect(diagnostic).toEqual({
      extractorMode: "reference-aware-gemini",
      apiKeyConfigured: true,
      configuredModel: "automatic",
      timeoutMilliseconds: 1_000,
      maxAttempts: 1,
      minRequestIntervalMilliseconds: 0,
      credentialSourceName: "GEMINI_API_KEY",
      googleApiKeyAlsoPresent: true,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("test-gemini-key");
    expect(JSON.stringify(diagnostic)).not.toContain("google-key");
  });

  it("succeeds when any candidate returns structured status OK", async () => {
    await expect(runGeminiDoctor({ env: env(), sdkLoader: sdk({}), now })).resolves.toMatchObject({
      status: "passed",
      modelListing: {
        requestSucceeded: true,
        modelsReturned: 1,
        generateContentCapableModels: ["gemini-3.5-flash-lite"],
      },
      preflight: {
        selectedModel: "gemini-3.5-flash-lite",
        selectionSource: "LISTED_CANDIDATE",
        structuredOutputValidated: true,
      },
      error: null,
    });
  });

  it("returns non-zero failure shape when every candidate fails", async () => {
    const generateContent = vi.fn(async () => {
      throw { status: 404, message: "not found" };
    });

    const report = await runGeminiDoctor({
      env: env(),
      sdkLoader: sdk({ generateContent }),
      now,
    });

    expect(report.status).toBe("failed");
    expect(report.preflight.selectedModel).toBeNull();
    expect(report.preflight.attemptedModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: "gemini-3.5-flash-lite",
          outcome: "MODEL_NOT_FOUND",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("test-gemini-key");
  });

  it("stops as authentication failure when model listing rejects with API_KEY_INVALID", async () => {
    const list = vi.fn(async () => {
      throw { status: 400, message: "API_KEY_INVALID test-gemini-key" };
    });

    const report = await runGeminiDoctor({
      env: env(),
      sdkLoader: sdk({ list }),
      now,
    });

    expect(report.status).toBe("failed");
    expect(report.error?.code).toBe("AUTHENTICATION_ERROR");
    expect(report.modelListing.requestSucceeded).toBe(false);
    expect(JSON.stringify(report)).not.toContain("test-gemini-key");
  });
});
