import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import {
  TriggeredFallbackObligationExtractionProvider,
  type ObligationExtractionInput,
  type ObligationExtractionProvider,
  type ObligationExtractionResult,
} from "../../src/modules/extraction/obligation-extraction.provider.js";
import { ExternalServiceError } from "../../src/shared/errors/external-service-error.js";

const input: ObligationExtractionInput = {
  pages: [{ pageNumber: 1, rawText: "Supplier shall deliver the report." }],
  context: {
    organizationId: "organization-id",
    contractId: "contract-id",
    documentId: "document-id",
    processingRunId: "processing-run-id",
  },
};
const fallbackResult: ObligationExtractionResult = {
  extraction: { obligations: [] },
  confidence: 0.75,
  provider: "GROQ",
};

function provider(extract: ObligationExtractionProvider["extract"]): ObligationExtractionProvider {
  return { extract };
}

function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("TriggeredFallbackObligationExtractionProvider", () => {
  it("uses fallback only when the trigger accepts the primary failure", async () => {
    const quotaError = new ExternalServiceError("DAILY_QUOTA_EXHAUSTED");
    const fallback = provider(vi.fn(async () => fallbackResult));
    const extractor = new TriggeredFallbackObligationExtractionProvider({
      primary: provider(vi.fn(async () => Promise.reject(quotaError))),
      fallback,
      shouldFallback: (error) => error === quotaError,
      logger: logger(),
    });

    await expect(extractor.extract(input)).resolves.toEqual(fallbackResult);
    expect(fallback.extract).toHaveBeenCalledOnce();
  });

  it("preserves non-triggering primary failures", async () => {
    const validationError = new Error("Invalid Gemini extraction response");
    const fallback = provider(vi.fn(async () => fallbackResult));
    const extractor = new TriggeredFallbackObligationExtractionProvider({
      primary: provider(vi.fn(async () => Promise.reject(validationError))),
      fallback,
      shouldFallback: () => false,
      logger: logger(),
    });

    await expect(extractor.extract(input)).rejects.toBe(validationError);
    expect(fallback.extract).not.toHaveBeenCalled();
  });
});
