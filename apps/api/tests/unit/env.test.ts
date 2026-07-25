/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import { getCorsOrigins, parseEnv } from "../../src/config/env.js";

describe("environment validation", () => {
  it("applies local defaults", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(3000);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.GROQ_EXTRACTION_MODEL).toBe("llama-3.1-8b-instant");
    expect(env.GROQ_EXTRACTION_MAX_ATTEMPTS).toBe(3);
    expect(env.OBLIGATION_EXTRACTOR_MODE).toBe("auto");
    expect(env.GEMINI_MODEL).toBeUndefined();
    expect(env.GEMINI_REQUEST_TIMEOUT_MS).toBe(45_000);
    expect(env.GEMINI_MAX_ATTEMPTS).toBe(3);
    expect(env.GEMINI_MAX_REQUESTS_PER_CONTRACT).toBe(8);
    expect(env.GEMINI_MIN_REQUEST_INTERVAL_MS).toBe(15_000);
    expect(env.GEMINI_MAX_QUOTA_RETRIES).toBe(4);
    expect(env.GEMINI_MAX_RETRY_DELAY_MS).toBe(120_000);
    expect(env.GEMINI_MAX_WINDOWS_PER_BATCH).toBe(4);
    expect(env.GEMINI_MAX_BATCH_INPUT_CHARACTERS).toBe(18_000);
    expect(env.GEMINI_MAX_BATCH_OUTPUT_TOKENS).toBe(6_000);
  });

  it("uses the Render PORT value when API_PORT is not set", () => {
    const env = parseEnv({
      PORT: "10000",
    });

    expect(env.API_PORT).toBe(10000);
  });

  it("keeps API_PORT precedence over PORT", () => {
    const env = parseEnv({
      API_PORT: "3001",
      PORT: "10000",
    });

    expect(env.API_PORT).toBe(3001);
  });

  it("parses comma-separated CORS origins", () => {
    expect(
      getCorsOrigins(
        "https://contract-obligation-tracker-1.onrender.com, https://contract-obligation-tracker.onrender.com",
      ),
    ).toEqual([
      "https://contract-obligation-tracker-1.onrender.com",
      "https://contract-obligation-tracker.onrender.com",
    ]);
  });

  it("parses the obligation extractor mode feature flag", () => {
    const env = parseEnv({
      OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
      GEMINI_API_KEY: "test-key",
      GEMINI_MODEL: "gemini-test-model",
    });

    expect(env.OBLIGATION_EXTRACTOR_MODE).toBe("reference-aware-gemini");
  });

  it("requires a Groq key when Groq is explicitly selected", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "groq",
      }),
    ).toThrow("GROQ_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=groq");
  });

  it("requires Gemini configuration when reference-aware Gemini is explicitly selected", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_MODEL: "gemini-test-model",
      }),
    ).toThrow("GEMINI_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini");
    const env = parseEnv({
      OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
      GEMINI_API_KEY: "test-key",
    });
    expect(env.GEMINI_MODEL).toBeUndefined();
  });

  it("parses Gemini structured LLM configuration", () => {
    const env = parseEnv({
      GEMINI_API_KEY: "  test-key  ",
      GEMINI_MODEL: "  gemini-test-model  ",
      GEMINI_REQUEST_TIMEOUT_MS: "30000",
      GEMINI_MAX_ATTEMPTS: "4",
      GEMINI_MAX_REQUESTS_PER_CONTRACT: "7",
      GEMINI_MIN_REQUEST_INTERVAL_MS: "250",
      GEMINI_MAX_QUOTA_RETRIES: "5",
      GEMINI_MAX_RETRY_DELAY_MS: "60000",
      GEMINI_MAX_WINDOWS_PER_BATCH: "3",
      GEMINI_MAX_BATCH_INPUT_CHARACTERS: "12000",
      GEMINI_MAX_BATCH_OUTPUT_TOKENS: "4000",
    });

    expect(env.GEMINI_API_KEY).toBe("test-key");
    expect(env.GEMINI_MODEL).toBe("gemini-test-model");
    expect(env.GEMINI_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(env.GEMINI_MAX_ATTEMPTS).toBe(4);
    expect(env.GEMINI_MAX_REQUESTS_PER_CONTRACT).toBe(7);
    expect(env.GEMINI_MIN_REQUEST_INTERVAL_MS).toBe(250);
    expect(env.GEMINI_MAX_QUOTA_RETRIES).toBe(5);
    expect(env.GEMINI_MAX_RETRY_DELAY_MS).toBe(60_000);
    expect(env.GEMINI_MAX_WINDOWS_PER_BATCH).toBe(3);
    expect(env.GEMINI_MAX_BATCH_INPUT_CHARACTERS).toBe(12_000);
    expect(env.GEMINI_MAX_BATCH_OUTPUT_TOKENS).toBe(4_000);
  });

  it("treats empty optional Gemini configuration as absent", () => {
    const env = parseEnv({
      GEMINI_API_KEY: "   ",
      GEMINI_MODEL: "   ",
    });

    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GEMINI_MODEL).toBeUndefined();
  });

  it("rejects placeholder Gemini values in explicit reference-aware mode", () => {
    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_API_KEY: "replace-me",
        GEMINI_MODEL: "gemini-test-model",
      }),
    ).toThrow("GEMINI_API_KEY must be a real local secret, not a placeholder");

    expect(() =>
      parseEnv({
        OBLIGATION_EXTRACTOR_MODE: "reference-aware-gemini",
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "YOUR_API_KEY",
      }),
    ).toThrow("GEMINI_MODEL must be a real model name, not a placeholder");
  });

  it("keeps GOOGLE_API_KEY separate from the explicit Gemini key", () => {
    const env = parseEnv({
      GEMINI_API_KEY: "gemini-key",
      GOOGLE_API_KEY: "google-key",
      GEMINI_MODEL: "gemini-test-model",
    });

    expect(env.GEMINI_API_KEY).toBe("gemini-key");
    expect(env.GOOGLE_API_KEY).toBe("google-key");
  });

  it("requires Brevo sender and API key when Brevo delivery is selected", () => {
    expect(() =>
      parseEnv({
        EMAIL_PROVIDER: "brevo",
      }),
    ).toThrow("EMAIL_FROM_ADDRESS is required when Brevo email delivery is enabled");

    const env = parseEnv({
      EMAIL_PROVIDER: "brevo",
      EMAIL_FROM_ADDRESS: "sender@example.com",
      EMAIL_FROM_NAME: "Contract Tracker",
      BREVO_API_KEY: "test-key",
    });
    expect(env.EMAIL_PROVIDER).toBe("brevo");
    expect(env.EMAIL_FROM_ADDRESS).toBe("sender@example.com");
    expect(env.EMAIL_FROM_NAME).toBe("Contract Tracker");
    expect(env.BREVO_API_KEY).toBe("test-key");
  });

  it("requires JWT_SECRET in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
      }),
    ).toThrow();
  });
});
