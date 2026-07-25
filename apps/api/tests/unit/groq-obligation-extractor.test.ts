/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import type { LlmProvider } from "../../src/infrastructure/llm/llm-provider.js";
import { ExternalServiceError } from "../../src/shared/errors/external-service-error.js";
import type { ObligationExtractionProvider } from "../../src/modules/extraction/obligation-extraction.provider.js";
import {
  GroqObligationExtractionProvider,
  HeuristicObligationExtractionProvider,
  type GroqObligationExtractionConfig,
} from "../../src/modules/extraction/obligation-extraction.provider.js";

const context = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  documentId: "00000000-0000-4000-8000-000000000003",
  processingRunId: "00000000-0000-4000-8000-000000000004",
};

const config: GroqObligationExtractionConfig = {
  model: "llama-3.1-8b-instant",
  timeoutMilliseconds: 1_000,
  maxAttempts: 2,
  retryBaseDelayMilliseconds: 1,
  retryMaxDelayMilliseconds: 1,
};

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
 * @description Performs the setup helper operation for this module.
 * @param {{ readonly parsedJson?: unknown; readonly rejectOnce?: unknown; readonly rejectAlways?: unknown; readonly fallback?: ObligationExtractionProvider; readonly overrideConfig?: Partial<GroqObligationExtractionConfig>; }} input - Input value for input.
 * @returns {unknown} Result of the setup operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function setup(input: {
  readonly parsedJson?: unknown;
  readonly rejectOnce?: unknown;
  readonly rejectAlways?: unknown;
  readonly fallback?: ObligationExtractionProvider;
  readonly overrideConfig?: Partial<GroqObligationExtractionConfig>;
}) {
  const llm: LlmProvider = {
    generateStructured: vi.fn(async () => {
      if (input.rejectAlways) {
        throw input.rejectAlways;
      }
      if (input.rejectOnce) {
        const error = input.rejectOnce;
        input = { ...input, rejectOnce: undefined };
        throw error;
      }
      return {
        rawText: JSON.stringify(input.parsedJson ?? { obligations: [] }),
        parsedJson: input.parsedJson ?? { obligations: [] },
      };
    }),
  };
  const fallback =
    input.fallback ??
    ({
      extract: vi.fn(async () => ({
        extraction: {
          obligations: [
            {
              text: "Fallback party shall provide notices.",
              anchor: {
                page_number: 1,
                line_offset: 1,
                quoted_text: "Fallback party shall provide notices.",
              },
            },
          ],
        },
        confidence: 0.8,
        provider: "HEURISTIC" as const,
      })),
    } satisfies ObligationExtractionProvider);
  const extractor = new GroqObligationExtractionProvider({
    llm,
    fallback,
    logger: logger(),
    config: { ...config, ...input.overrideConfig },
  });

  return { extractor, fallback, llm };
}

/**
 * @description Performs the rich obligation helper operation for this module.
 * @param {Partial<{ title: string; description: string; obligationType: string; obligatedParty: string | null; beneficiaryParty: string | null; action: string; deliverable: string | null; explicitDueDate: string | null; pageNumber: number; lineStart: number; lineEnd: number; startOffset: number; endOffset: number; sourceText: string; }>} overrides - Input value for overrides.
 * @returns {unknown} Result of the rich obligation operation.
 */
function richObligation(
  overrides: Partial<{
    title: string;
    description: string;
    obligationType: string;
    obligatedParty: string | null;
    beneficiaryParty: string | null;
    action: string;
    deliverable: string | null;
    explicitDueDate: string | null;
    pageNumber: number;
    lineStart: number;
    lineEnd: number;
    startOffset: number;
    endOffset: number;
    sourceText: string;
  }>,
) {
  const description = overrides.description ?? "Vendor shall maintain insurance.";
  return {
    title: overrides.title ?? description,
    description,
    obligationType: overrides.obligationType ?? "COMPLIANCE",
    obligatedParty: overrides.obligatedParty ?? "Vendor",
    beneficiaryParty: overrides.beneficiaryParty ?? null,
    action: overrides.action ?? "shall maintain",
    deliverable: overrides.deliverable ?? null,
    timing: {
      explicitDueDate: overrides.explicitDueDate ?? null,
      triggerEvent: null,
      triggerDate: null,
      offsetValue: null,
      offsetUnit: null,
      offsetDirection: null,
      recurrenceFrequency: null,
      recurrenceInterval: null,
      gracePeriodDays: null,
    },
    conditions: [],
    exceptions: [],
    financialTerms: {
      amount: null,
      currency: null,
      percentage: null,
      calculationBasis: null,
    },
    consequence: null,
    penalty: null,
    sourceAnchors: [
      {
        pageNumber: overrides.pageNumber ?? 1,
        lineStart: overrides.lineStart ?? 1,
        lineEnd: overrides.lineEnd ?? 1,
        startOffset: overrides.startOffset ?? 0,
        endOffset: overrides.endOffset ?? description.length,
        sourceText: overrides.sourceText ?? description,
      },
    ],
    confidence: {
      overall: 0.9,
      obligatedParty: 0.8,
      action: 0.9,
      timing: 0.5,
      sourceAnchor: 0.95,
    },
    warnings: [],
    missingFields: [],
  };
}

describe("GroqObligationExtractionProvider", () => {
  it("extracts source-verified obligations from Groq JSON", async () => {
    const { extractor } = setup({
      parsedJson: {
        obligations: [
          richObligation({
            title: "Monthly reports",
            description: "Vendor shall deliver monthly reports by 2026-08-15.",
            pageNumber: 1,
            lineStart: 2,
            lineEnd: 2,
            startOffset: "Section 1. Services.\n".length,
            endOffset: "Section 1. Services.\nVendor shall deliver monthly reports by 2026-08-15."
              .length,
            sourceText: "Vendor shall deliver monthly reports by 2026-08-15.",
            explicitDueDate: "2026-08-15",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [
        {
          pageNumber: 1,
          rawText: "Section 1. Services.\nVendor shall deliver monthly reports by 2026-08-15.",
        },
      ],
    });

    expect(result.provider).toBe("GROQ");
    expect(result.extraction.obligations).toEqual([
      {
        text: "Vendor shall deliver monthly reports by 2026-08-15.",
        anchor: {
          page_number: 1,
          line_offset: 1,
          quoted_text: "Vendor shall deliver monthly reports by 2026-08-15.",
          start_line: 2,
          end_line: 2,
          source: "groq_obligation",
          start_offset: "Section 1. Services.\n".length,
          end_offset: "Section 1. Services.\nVendor shall deliver monthly reports by 2026-08-15."
            .length,
          obligation_type: "COMPLIANCE",
          obligated_party: "Vendor",
          beneficiary_party: null,
          action: "shall maintain",
          deliverable: null,
          timing: expect.objectContaining({ explicitDueDate: "2026-08-15" }),
          conditions: [],
          exceptions: [],
          financial_terms: expect.objectContaining({ amount: null }),
          consequence: null,
          penalty: null,
          confidence: expect.objectContaining({ overall: 0.9 }),
          warnings: [],
          missing_fields: [],
        },
      },
    ]);
  });

  it("keeps multiple obligations from the same text segment", async () => {
    const { extractor } = setup({
      parsedJson: {
        obligations: [
          richObligation({
            description: "Customer must pay invoices within 30 days.",
            pageNumber: 1,
            lineStart: 1,
            lineEnd: 1,
            startOffset: 0,
            endOffset: "Customer must pay invoices within 30 days.".length,
            sourceText: "Customer must pay invoices within 30 days.",
          }),
          richObligation({
            description: "Vendor shall maintain insurance.",
            pageNumber: 1,
            lineStart: 2,
            lineEnd: 2,
            startOffset: "Customer must pay invoices within 30 days.\n".length,
            endOffset:
              "Customer must pay invoices within 30 days.\nVendor shall maintain insurance.".length,
            sourceText: "Vendor shall maintain insurance.",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [
        {
          pageNumber: 1,
          rawText: "Customer must pay invoices within 30 days.\nVendor shall maintain insurance.",
        },
      ],
    });

    expect(result.extraction.obligations).toHaveLength(2);
  });

  it("supports no-obligation responses", async () => {
    const { extractor } = setup({ parsedJson: { obligations: [] } });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "This page contains definitions only." }],
    });

    expect(result.provider).toBe("GROQ");
    expect(result.extraction.obligations).toEqual([]);
  });

  it("preserves multi-line source anchors", async () => {
    const { extractor } = setup({
      parsedJson: {
        obligations: [
          richObligation({
            description: "Vendor shall provide services and maintain logs.",
            pageNumber: 3,
            lineStart: 2,
            lineEnd: 3,
            startOffset: "Definitions\n".length,
            endOffset: "Definitions\nVendor shall provide services and\nmaintain logs.".length,
            sourceText: "Vendor shall provide services and maintain logs.",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [
        {
          pageNumber: 3,
          rawText: "Definitions\nVendor shall provide services and\nmaintain logs.",
        },
      ],
    });

    expect(result.extraction.obligations?.[0]?.anchor).toMatchObject({
      page_number: 3,
      line_offset: 1,
      start_line: 2,
      end_line: 3,
    });
  });

  it("drops hallucinated page references", async () => {
    const { extractor } = setup({
      parsedJson: {
        obligations: [
          richObligation({
            description: "Vendor shall maintain insurance.",
            pageNumber: 99,
            lineStart: 1,
            lineEnd: 1,
            sourceText: "Vendor shall maintain insurance.",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(result.extraction.obligations).toEqual([]);
  });

  it("drops source quotes that are not present in the selected lines", async () => {
    const { extractor } = setup({
      parsedJson: {
        obligations: [
          richObligation({
            description: "Vendor shall maintain insurance.",
            pageNumber: 1,
            lineStart: 1,
            lineEnd: 1,
            sourceText: "Customer shall maintain insurance.",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(result.extraction.obligations).toEqual([]);
  });

  it("falls back to heuristics when schema validation fails", async () => {
    const fallback = new HeuristicObligationExtractionProvider();
    const { extractor } = setup({
      parsedJson: { obligations: [{ description: "" }] },
      fallback,
      overrideConfig: { maxAttempts: 1 },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(result.provider).toBe("HEURISTIC");
    expect(result.extraction.obligations?.[0]?.text).toBe("Vendor shall maintain insurance.");
  });

  it("falls back when Groq returns invalid JSON through the adapter", async () => {
    const { extractor, fallback } = setup({
      rejectAlways: new SyntaxError("Unexpected token"),
      overrideConfig: { maxAttempts: 1 },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(fallback.extract).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("HEURISTIC");
  });

  it("falls back when Groq times out", async () => {
    const timeoutError = new Error("timeout");
    timeoutError.name = "AbortError";
    const { extractor } = setup({
      rejectAlways: timeoutError,
      overrideConfig: { maxAttempts: 1 },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(result.provider).toBe("HEURISTIC");
  });

  it("retries transient Groq failures before returning successful output", async () => {
    const { extractor, llm } = setup({
      rejectOnce: new ExternalServiceError("temporary failure", { retryable: true }),
      parsedJson: {
        obligations: [
          richObligation({
            description: "Vendor shall maintain insurance.",
            pageNumber: 1,
            lineStart: 1,
            lineEnd: 1,
            sourceText: "Vendor shall maintain insurance.",
          }),
        ],
      },
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(llm.generateStructured).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe("GROQ");
    expect(result.extraction.obligations).toHaveLength(1);
  });

  it("does not retry permanent Groq failures", async () => {
    const { extractor, llm } = setup({
      rejectAlways: new ExternalServiceError("authentication failed", { retryable: false }),
    });

    const result = await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Vendor shall maintain insurance." }],
    });

    expect(llm.generateStructured).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("HEURISTIC");
  });

  it("passes model, timeout, schema name, and correlation id to Groq", async () => {
    const { extractor, llm } = setup({ parsedJson: { obligations: [] } });

    await extractor.extract({
      context,
      pages: [{ pageNumber: 1, rawText: "Definitions only." }],
    });

    expect(llm.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "llama-3.1-8b-instant",
        responseSchemaName: "contract_obligation_extraction",
        timeoutMilliseconds: 1_000,
        correlationId: context.processingRunId,
      }),
    );
  });

  it("compacts large contracts to obligation candidate lines before calling Groq", async () => {
    const { extractor, llm } = setup({ parsedJson: { obligations: [] } });
    const filler = Array.from(
      { length: 400 },
      (_, index) => `Definition ${index}: this paragraph describes background terms only.`,
    ).join("\n");

    await extractor.extract({
      context,
      pages: [
        {
          pageNumber: 1,
          rawText: `${filler}\nVendor shall deliver quarterly compliance reports within 10 days.`,
        },
      ],
    });

    expect(llm.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          "Vendor shall deliver quarterly compliance reports within 10 days.",
        ),
      }),
    );
    const request = vi.mocked(llm.generateStructured).mock.calls[0]?.[0];
    expect(request?.prompt.length).toBeLessThan(10_000);
    expect(request?.prompt).not.toContain("Definition 200");
  });
});
