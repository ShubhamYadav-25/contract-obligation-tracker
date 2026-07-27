/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import { FakeStructuredLlmClient } from "../../src/infrastructure/llm/fake-structured-llm-client.js";
import type {
  StructuredLlmClient,
  StructuredLlmMetricsProvider,
  StructuredLlmRequestBudgetProvider,
  StructuredLlmRequest,
} from "../../src/infrastructure/llm/structured-llm-client.js";
import { ReferenceAwareObligationExtractor } from "../../src/modules/extraction/reference-aware/index.js";

const context = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  documentId: "00000000-0000-4000-8000-000000000003",
  processingRunId: "00000000-0000-4000-8000-000000000004",
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
 * @description Performs the pages helper operation for this module.
 * @param {readonly string[]} lines - Input value for lines.
 * @returns {unknown} Result of the pages operation.
 */
function pages(
  lines: readonly string[] = [
    'This Agreement is between Acme Network Corporation ("Provider") and Beta Affiliate LLC ("Customer").',
    "Section 2. Payment",
    "Customer shall pay the Fees.",
    "Payment is due within thirty (30) days after receipt of invoice.",
  ],
) {
  return [
    {
      pageNumber: 1,
      rawText: lines.join("\n"),
    },
  ];
}

/**
 * @description Performs the queue context helper operation for this module.
 * @param {FakeStructuredLlmClient} llm - Input value for llm.
 * @returns {void} Result of the queue context operation.
 */
function queueContext(llm: FakeStructuredLlmClient): void {
  llm.queueResponse("contract_context_extraction", {
    parties: [
      {
        roleLabel: "Provider",
        canonicalName: "Acme Network Corporation",
        aliases: [],
        sourceSpan: { startLine: 1, endLine: 1 },
      },
      {
        roleLabel: "Customer",
        canonicalName: "Beta Affiliate LLC",
        aliases: [],
        sourceSpan: { startLine: 1, endLine: 1 },
      },
    ],
    definedTerms: [
      {
        term: "Fees",
        definition: "recurring subscription fees",
        referencedSection: null,
        referencedExhibit: null,
        resolutionStatus: "RESOLVED",
        sourceSpan: { startLine: 3, endLine: 3 },
      },
    ],
    keyDates: [],
    sectionHeadings: [],
  });
}

/**
 * @description Performs the raw payment candidate helper operation for this module.
 * @param {Record<string, unknown>} overrides - Input value for overrides.
 * @returns {unknown} Result of the raw payment candidate operation.
 */
function rawPaymentCandidate(overrides: Record<string, unknown> = {}) {
  return {
    businessType: "PAYMENT",
    timingType: "RELATIVE_DEADLINE",
    responsibleParty: {
      explicitText: "Customer",
      roleLabel: null,
      canonicalName: null,
      resolutionMethod: "CONTRACT_PARTY_MAP",
      supportingEvidence: [{ startLine: 3, endLine: 3, evidenceRole: "ACTOR" }],
      confidence: 0.92,
      reviewReasons: [],
    },
    counterparty: null,
    action: "pay",
    object: "Fees",
    summary: "Customer shall pay the Fees within thirty days after invoice receipt.",
    explicitDueDate: null,
    triggerEvent: "receipt of invoice",
    referenceDateLabel: null,
    offsetValue: 30,
    offsetUnit: "days",
    offsetDirection: "after",
    frequency: null,
    duration: null,
    referencedTerms: ["Fees"],
    crossReferences: [],
    evidenceSpans: [
      { startLine: 3, endLine: 3, evidenceRole: "ACTOR" },
      { startLine: 3, endLine: 3, evidenceRole: "ACTION" },
      { startLine: 4, endLine: 4, evidenceRole: "TIMING" },
    ],
    confidence: 0.91,
    reviewRequired: false,
    reviewReasons: [],
    ...overrides,
  };
}

/**
 * @description Performs the queue payment candidate helper operation for this module.
 * @param {FakeStructuredLlmClient} llm - Input value for llm.
 * @param {Record<string, unknown>} overrides - Input value for overrides.
 * @returns {void} Result of the queue payment candidate operation.
 */
function queuePaymentCandidate(
  llm: FakeStructuredLlmClient,
  overrides: Record<string, unknown> = {},
): void {
  llm.queueResponse("obligation_candidate_extraction", {
    candidates: [rawPaymentCandidate(overrides)],
  });
}

/**
 * @description Performs the queue candidates helper operation for this module.
 * @param {FakeStructuredLlmClient} llm - Input value for llm.
 * @param {readonly unknown[]} candidates - Input value for candidates.
 * @returns {void} Result of the queue candidates operation.
 */
function queueCandidates(llm: FakeStructuredLlmClient, candidates: readonly unknown[]): void {
  llm.queueResponse("obligation_candidate_extraction", { candidates });
}

class MetricsStructuredLlmClient implements StructuredLlmClient, StructuredLlmMetricsProvider {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {FakeStructuredLlmClient} delegate - Input value for delegate.
   * @param {number} retryCount - Input value for retry count.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly delegate: FakeStructuredLlmClient,
    private readonly retryCount: number,
  ) {}

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {StructuredLlmRequest<T>} request - Input value for request.
   * @returns {Promise<T>} Result of the generate structured operation.
   */
  generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T> {
    return this.delegate.generateStructured(request);
  }

  /**
   * @description Executes the get metrics snapshot operation used by the application workflow.
   * @returns {unknown} Result of the get metrics snapshot operation.
   */
  getMetricsSnapshot() {
    return { retryCount: this.delegate.prompts.length > 0 ? this.retryCount : 0 };
  }
}

class BudgetedStructuredLlmClient
  implements StructuredLlmClient, StructuredLlmRequestBudgetProvider
{
  resetCount = 0;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {FakeStructuredLlmClient} delegate - Input value for delegate.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly delegate: FakeStructuredLlmClient) {}

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {StructuredLlmRequest<T>} request - Input value for request.
   * @returns {Promise<T>} Result of the generate structured operation.
   */
  generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T> {
    return this.delegate.generateStructured(request);
  }

  /**
   * @description Implements the reset request budget scope method for this service or adapter.
   * @returns {void} Result of the reset request budget scope operation.
   */
  resetRequestBudgetScope(): void {
    this.resetCount += 1;
  }
}

/**
 * @description Performs the extract helper operation for this module.
 * @param {{ readonly llm: StructuredLlmClient; readonly sourcePages?: ReturnType<typeof pages>; }} input - Input value for input.
 * @returns {Promise<unknown>} Result of the extract operation.
 */
async function extract(input: {
  readonly llm: StructuredLlmClient;
  readonly sourcePages?: ReturnType<typeof pages>;
}) {
  return new ReferenceAwareObligationExtractor({
    llm: input.llm,
    logger: logger(),
  }).extract({
    pages: input.sourcePages ?? pages(),
    context,
  });
}

describe("ReferenceAwareObligationExtractor", () => {
  it("maps confirmed source-verified obligations into the current extractor output contract", async () => {
    const llm = new FakeStructuredLlmClient();
    queueContext(llm);
    queuePaymentCandidate(llm);

    const result = await extract({ llm });

    expect(result.provider).toBe("REFERENCE_AWARE_GEMINI");
    expect(result.extraction.obligations).toHaveLength(1);
    expect(result.extraction.obligations?.[0]).toMatchObject({
      text: "Customer shall pay the Fees within thirty days after invoice receipt.",
      anchor: {
        source: "reference_aware_obligation",
        page_number: 1,
        start_line: 3,
        end_line: 3,
        obligated_party: "Beta Affiliate LLC",
        action: "pay",
        deliverable: "Fees",
      },
    });
    expect(result.metadata?.metrics).toMatchObject({
      candidateWindows: 1,
      rawCandidates: 1,
      confirmed: 1,
      reviewRequired: 0,
      rejected: 0,
      llmRequestCount: 2,
    });
  });

  it("maps review-required findings into obligations while preserving review metadata", async () => {
    const llm = new FakeStructuredLlmClient();
    queueContext(llm);
    queuePaymentCandidate(llm, {
      responsibleParty: {
        explicitText: "the other party",
        roleLabel: null,
        canonicalName: null,
        resolutionMethod: "UNRESOLVED",
        supportingEvidence: [{ startLine: 3, endLine: 3, evidenceRole: "ACTOR" }],
        confidence: 0.2,
        reviewReasons: ["Other party is ambiguous"],
      },
      reviewRequired: true,
      reviewReasons: ["Other party is ambiguous"],
    });

    const result = await extract({ llm });

    expect(result.extraction.obligations).toHaveLength(1);
    expect(result.extraction.obligations?.[0]).toMatchObject({
      anchor: {
        confidence: expect.objectContaining({
          reviewStatus: "REVIEW_REQUIRED",
        }),
      },
    });
    expect(result.metadata?.metrics?.reviewRequired).toBe(1);
    expect(result.metadata?.reviewRequiredCandidates?.[0]).toMatchObject({
      summary: "Customer shall pay the Fees within thirty days after invoice receipt.",
      reviewReasons: expect.arrayContaining(["Responsible party is unresolved"]),
    });
  });

  it("keeps review metadata compact and JSON-safe", async () => {
    const llm = new FakeStructuredLlmClient();
    queueContext(llm);
    queuePaymentCandidate(llm, {
      responsibleParty: {
        explicitText: "the other party",
        roleLabel: null,
        canonicalName: null,
        resolutionMethod: "UNRESOLVED",
        supportingEvidence: [{ startLine: 3, endLine: 3, evidenceRole: "ACTOR" }],
        confidence: 0.2,
        reviewReasons: ["Other party is ambiguous"],
      },
      reviewRequired: true,
      reviewReasons: ["Other party is ambiguous"],
    });

    const result = await extract({ llm });
    const metadataJson = JSON.stringify(result.metadata);

    expect(() => JSON.parse(metadataJson)).not.toThrow();
    expect(metadataJson).not.toContain("test-key");
    expect(metadataJson).not.toContain("CONTRACT PARTY MAP");
    expect(metadataJson).not.toContain("This Agreement is between Acme Network Corporation");
    expect(result.metadata?.reviewRequiredCandidates?.[0]?.sourceReferences).toEqual([
      { pageNumber: 1, startLine: 3, endLine: 3, globalStartLine: 3, globalEndLine: 3 },
      { pageNumber: 1, startLine: 4, endLine: 4, globalStartLine: 4, globalEndLine: 4 },
    ]);
  });

  it("reports duplicate removal, consolidation, and retry metrics deterministically", async () => {
    const fake = new FakeStructuredLlmClient();
    const llm = new MetricsStructuredLlmClient(fake, 2);
    queueContext(fake);
    queueCandidates(fake, [
      rawPaymentCandidate(),
      rawPaymentCandidate(),
      rawPaymentCandidate({
        timingType: "NO_EXPLICIT_DEADLINE",
        object: "Support Fee",
        summary: "Customer shall pay the Support Fee.",
        triggerEvent: null,
        offsetValue: null,
        offsetUnit: null,
        offsetDirection: null,
        referencedTerms: [],
        evidenceSpans: [
          { startLine: 5, endLine: 5, evidenceRole: "ACTOR" },
          { startLine: 5, endLine: 5, evidenceRole: "ACTION" },
        ],
      }),
      rawPaymentCandidate({
        object: "Support Fee",
        summary: "Payment of the Support Fee is due monthly.",
        triggerEvent: null,
        offsetValue: null,
        offsetUnit: null,
        offsetDirection: null,
        frequency: "monthly",
        referencedTerms: [],
        evidenceSpans: [
          { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
          { startLine: 6, endLine: 6, evidenceRole: "TIMING" },
        ],
      }),
    ]);

    const result = await extract({
      llm,
      sourcePages: pages([
        'This Agreement is between Acme Network Corporation ("Provider") and Beta Affiliate LLC ("Customer").',
        "Section 2. Payment",
        "Customer shall pay the Fees.",
        "Payment is due within thirty (30) days after receipt of invoice.",
        "Customer shall pay the Support Fee.",
        "Payment of the Support Fee is due monthly.",
      ]),
    });

    expect(result.metadata?.metrics).toMatchObject({
      candidateWindows: 1,
      rawCandidates: 4,
      confirmed: 2,
      reviewRequired: 0,
      rejected: 0,
      duplicateRemovals: 1,
      consolidations: 1,
      llmRequestCount: 2,
      retryCount: 2,
    });
    expect(result.metadata?.metrics?.extractionDurationMilliseconds).toBeGreaterThanOrEqual(0);
  });

  it("returns stable output when processing the same source and candidates twice", async () => {
    /**
     * @description Performs the run helper operation for this module.
     * @returns {Promise<unknown>} Result of the run operation.
     */
    const run = async () => {
      const llm = new FakeStructuredLlmClient();
      queueContext(llm);
      queuePaymentCandidate(llm);
      return extract({ llm });
    };

    const first = await run();
    const second = await run();

    expect(second.extraction).toEqual(first.extraction);
    expect(second.metadata?.metrics).toMatchObject({
      candidateWindows: first.metadata?.metrics?.candidateWindows,
      rawCandidates: first.metadata?.metrics?.rawCandidates,
      confirmed: first.metadata?.metrics?.confirmed,
      reviewRequired: first.metadata?.metrics?.reviewRequired,
      rejected: first.metadata?.metrics?.rejected,
      duplicateRemovals: first.metadata?.metrics?.duplicateRemovals,
      consolidations: first.metadata?.metrics?.consolidations,
      llmRequestCount: first.metadata?.metrics?.llmRequestCount,
      retryCount: first.metadata?.metrics?.retryCount,
    });
  });

  it("resets delegate request budget at the start of every extraction", async () => {
    const fake = new FakeStructuredLlmClient();
    const llm = new BudgetedStructuredLlmClient(fake);
    queueContext(fake);
    queuePaymentCandidate(fake);
    queueContext(fake);
    queuePaymentCandidate(fake);
    const extractor = new ReferenceAwareObligationExtractor({
      llm,
      logger: logger(),
    });

    await extractor.extract({ pages: pages(), context });
    await extractor.extract({ pages: pages(), context });

    expect(llm.resetCount).toBe(2);
  });
});
