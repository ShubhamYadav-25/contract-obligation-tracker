import { describe, expect, it } from "vitest";

import { FakeStructuredLlmClient } from "../../src/infrastructure/llm/fake-structured-llm-client.js";
import {
  ContractSourceIndex,
  ObligationCandidateExtractor,
  RelevantContextSelector,
  buildCandidateWindowBatches,
  detectCandidateWindows,
  type ContractContextExtractionResult,
  type ContractSourceLineInput,
  type DetectedCandidateWindow,
} from "../../src/modules/extraction/reference-aware/index.js";

function sourceIndex(): ContractSourceIndex {
  const lines: readonly ContractSourceLineInput[] = [
    {
      globalLineNumber: 1,
      pageNumber: 1,
      pageLocalLineNumber: 1,
      text:
        'This Agreement is between Acme Network Corporation ("Provider", "Network") and Beta Affiliate LLC ("Customer", "Affiliate").',
      sourceMethod: "PDF_TEXT",
    },
    {
      globalLineNumber: 2,
      pageNumber: 1,
      pageLocalLineNumber: 2,
      text: "Section 1. Definitions",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 3,
      pageNumber: 1,
      pageLocalLineNumber: 3,
      text: '"Fees" means the recurring subscription fees listed in Order Form A.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 4,
      pageNumber: 1,
      pageLocalLineNumber: 4,
      text: '"Services" has the meaning set forth in Exhibit D.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 5,
      pageNumber: 1,
      pageLocalLineNumber: 5,
      text: "Section 2. Payment",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 6,
      pageNumber: 1,
      pageLocalLineNumber: 6,
      text: "Customer shall pay the Fees.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 7,
      pageNumber: 1,
      pageLocalLineNumber: 7,
      text: "Payment is due within thirty (30) days after receipt of invoice.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 8,
      pageNumber: 1,
      pageLocalLineNumber: 8,
      text: "Section 3. Onboarding",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Onboarding"],
    },
    {
      globalLineNumber: 9,
      pageNumber: 1,
      pageLocalLineNumber: 9,
      text: "Provider will initiate onboarding after the Effective Date.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Onboarding"],
    },
    {
      globalLineNumber: 10,
      pageNumber: 1,
      pageLocalLineNumber: 10,
      text:
        "It shall deliver the activation package within five (5) business days after kickoff.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Onboarding"],
    },
    {
      globalLineNumber: 11,
      pageNumber: 1,
      pageLocalLineNumber: 11,
      text: "Either party may request a status meeting.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Rights"],
    },
    {
      globalLineNumber: 12,
      pageNumber: 1,
      pageLocalLineNumber: 12,
      text: '"Affiliate" shall mean any entity under common control with a party.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 13,
      pageNumber: 1,
      pageLocalLineNumber: 13,
      text: "The other party shall return equipment within ten days after termination.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Return"],
    },
    {
      globalLineNumber: 14,
      pageNumber: 1,
      pageLocalLineNumber: 14,
      text: "Customer shall maintain insurance certificates during the Term.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Insurance"],
    },
    {
      globalLineNumber: 15,
      pageNumber: 2,
      pageLocalLineNumber: 1,
      text: "Provider shall submit a final report after termination.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Post-Termination"],
    },
  ];

  return new ContractSourceIndex(lines);
}

function context(): ContractContextExtractionResult {
  return {
    context: {
      parties: [
        {
          roleLabel: "Provider",
          canonicalName: "Acme Network Corporation",
          aliases: ["Network"],
          source: { pageNumber: 1, startLine: 1, endLine: 1 },
        },
        {
          roleLabel: "Customer",
          canonicalName: "Beta Affiliate LLC",
          aliases: ["Affiliate", "Customer"],
          source: { pageNumber: 1, startLine: 1, endLine: 1 },
        },
      ],
      definedTerms: [
        {
          term: "Fees",
          definition: "the recurring subscription fees listed in Order Form A",
          referencedSection: null,
          referencedExhibit: null,
          resolutionStatus: "RESOLVED",
          source: { pageNumber: 1, startLine: 3, endLine: 3 },
        },
        {
          term: "Services",
          definition: null,
          referencedSection: null,
          referencedExhibit: "Exhibit D",
          resolutionStatus: "UNRESOLVED",
          source: { pageNumber: 1, startLine: 4, endLine: 4 },
        },
        {
          term: "Privacy Laws",
          definition: "all laws applicable to personal data",
          referencedSection: null,
          referencedExhibit: null,
          resolutionStatus: "RESOLVED",
          source: { pageNumber: 1, startLine: 99, endLine: 99 },
        },
      ],
      keyDates: [],
    },
    parties: [
      {
        roleLabel: "Provider",
        canonicalName: "Acme Network Corporation",
        aliases: ["Network"],
        source: { pageNumber: 1, startLine: 1, endLine: 1 },
        sourceReference: {
          globalStartLine: 1,
          globalEndLine: 1,
          pageRange: { pageNumber: 1, startLine: 1, endLine: 1 },
          exactQuote:
            'This Agreement is between Acme Network Corporation ("Provider", "Network") and Beta Affiliate LLC ("Customer", "Affiliate").',
        },
      },
      {
        roleLabel: "Customer",
        canonicalName: "Beta Affiliate LLC",
        aliases: ["Affiliate", "Customer"],
        source: { pageNumber: 1, startLine: 1, endLine: 1 },
        sourceReference: {
          globalStartLine: 1,
          globalEndLine: 1,
          pageRange: { pageNumber: 1, startLine: 1, endLine: 1 },
          exactQuote:
            'This Agreement is between Acme Network Corporation ("Provider", "Network") and Beta Affiliate LLC ("Customer", "Affiliate").',
        },
      },
    ],
    definedTerms: [
      {
        term: "Fees",
        definition: "the recurring subscription fees listed in Order Form A",
        referencedSection: null,
        referencedExhibit: null,
        resolutionStatus: "RESOLVED",
        source: { pageNumber: 1, startLine: 3, endLine: 3 },
        sourceReference: {
          globalStartLine: 3,
          globalEndLine: 3,
          pageRange: { pageNumber: 1, startLine: 3, endLine: 3 },
          exactQuote: '"Fees" means the recurring subscription fees listed in Order Form A.',
        },
      },
      {
        term: "Services",
        definition: null,
        referencedSection: null,
        referencedExhibit: "Exhibit D",
        resolutionStatus: "UNRESOLVED",
        source: { pageNumber: 1, startLine: 4, endLine: 4 },
        sourceReference: {
          globalStartLine: 4,
          globalEndLine: 4,
          pageRange: { pageNumber: 1, startLine: 4, endLine: 4 },
          exactQuote: '"Services" has the meaning set forth in Exhibit D.',
        },
      },
      {
        term: "Privacy Laws",
        definition: "all laws applicable to personal data",
        referencedSection: null,
        referencedExhibit: null,
        resolutionStatus: "RESOLVED",
        source: { pageNumber: 1, startLine: 99, endLine: 99 },
        sourceReference: {
          globalStartLine: 99,
          globalEndLine: 99,
          pageRange: { pageNumber: 1, startLine: 99, endLine: 99 },
          exactQuote: "Privacy Laws definition",
        },
      },
    ],
    keyDates: [],
    sectionHeadings: [],
    rejectedItems: [],
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    businessType: "PAYMENT",
    timingType: "RELATIVE_DEADLINE",
    responsibleParty: {
      explicitText: "Customer",
      roleLabel: null,
      canonicalName: null,
      resolutionMethod: "CONTRACT_PARTY_MAP",
      supportingEvidence: [{ startLine: 6, endLine: 6, evidenceRole: "ACTOR" }],
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
      { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
      { startLine: 7, endLine: 7, evidenceRole: "TIMING" },
    ],
    confidence: 0.91,
    reviewRequired: false,
    reviewReasons: [],
    ...overrides,
  };
}

function windows(index: ContractSourceIndex): readonly DetectedCandidateWindow[] {
  return detectCandidateWindows(index, {
    precedingContextLineCount: 1,
    followingContextLineCount: 1,
    maxWindowLineCount: 8,
    maxWindowCharacters: 2_000,
    mergeGapLineCount: 1,
  });
}

function windowForLine(
  index: ContractSourceIndex,
  globalLineNumber: number,
): DetectedCandidateWindow {
  const detected = windows(index).find((window) =>
    window.sourceLines.some((line) => line.globalLineNumber === globalLineNumber),
  );
  if (detected) {
    return detected;
  }
  const sourceLine = index.getLine(globalLineNumber);
  if (!sourceLine) {
    throw new Error(`Missing test line ${globalLineNumber}`);
  }
  return {
    id: `manual_${globalLineNumber}`,
    globalStartLine: globalLineNumber,
    globalEndLine: globalLineNumber,
    targetGlobalLines: [globalLineNumber],
    contextSpans: [],
    targetSpans: [
      {
        pageNumber: sourceLine.pageNumber,
        startLine: sourceLine.pageLocalLineNumber ?? sourceLine.globalLineNumber,
        endLine: sourceLine.pageLocalLineNumber ?? sourceLine.globalLineNumber,
      },
    ],
    sectionPath: sourceLine.sectionPath,
    cueTypes: [],
    characterCount: sourceLine.normalizedText.length,
    sourceMethod: sourceLine.sourceMethod,
    sourceLines: [sourceLine],
  };
}

async function extract(input: {
  readonly selectedWindows: readonly DetectedCandidateWindow[];
  readonly responses: readonly unknown[];
  readonly selector?: RelevantContextSelector;
}) {
  const llm = new FakeStructuredLlmClient();
  for (const [index, response] of input.responses.entries()) {
    if (
      response &&
      typeof response === "object" &&
      "candidates" in response &&
      !("windowResults" in response)
    ) {
      const window = input.selectedWindows[index] ?? input.selectedWindows[0];
      llm.queueResponse("obligation_candidate_extraction", {
        windowResults: [{ windowId: window?.id ?? "missing", obligations: (response as { candidates: unknown }).candidates }],
      });
      continue;
    }
    llm.queueResponse("obligation_candidate_extraction", response);
  }
  const extractor = new ObligationCandidateExtractor({
    llm,
    relevantContextSelector: input.selector ?? new RelevantContextSelector({ nearbyLineCount: 0 }),
    config: { lowConfidenceThreshold: 0.7 },
  });

  return {
    llm,
    result: await extractor.extract({
      sourceIndex: sourceIndex(),
      windows: input.selectedWindows,
      context: context(),
    }),
  };
}

describe("ObligationCandidateExtractor", () => {
  it("extracts an obligation with an explicit actor", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { llm, result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [{ candidates: [candidate()] }],
    });

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.responsibleParty).toMatchObject({
      roleLabel: "Customer",
      canonicalName: "Beta Affiliate LLC",
    });
    expect(result.confirmed[0]?.verifiedEvidenceSpans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageNumber: 1,
          startLine: 6,
          endLine: 6,
          exactQuote: "Customer shall pay the Fees.",
        }),
      ]),
    );
    expect(llm.prompts[0]?.prompt).toContain("CONTRACT PARTY MAP");
    expect(llm.prompts[0]?.prompt).toContain("RELEVANT DEFINED TERMS");
    expect(llm.prompts[0]?.prompt).toContain("SECTION PATH");
    expect(llm.prompts[0]?.prompt).toContain("PREVIOUS/TARGET/FOLLOWING SOURCE LINES");
    expect(llm.prompts[0]?.prompt).toContain("EXTRACTION SCOPE");
    expect(llm.prompts[0]?.prompt).toContain("REFERENCE-RESOLUTION RULES");
  });

  it("allows an actor inherited from the previous sentence", async () => {
    const index = sourceIndex();
    const onboardingWindow = windowForLine(index, 10);
    const { result } = await extract({
      selectedWindows: [onboardingWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "DELIVERY",
              timingType: "RELATIVE_DEADLINE",
              responsibleParty: {
                explicitText: "It",
                roleLabel: null,
                canonicalName: "Acme Network Corporation",
                resolutionMethod: "INHERITED_FROM_ADJACENT_CONTEXT",
                supportingEvidence: [
                  { startLine: 9, endLine: 9, evidenceRole: "ACTOR" },
                ],
                confidence: 0.86,
                reviewReasons: [],
              },
              action: "deliver",
              object: "activation package",
              summary: "Provider shall deliver the activation package after kickoff.",
              triggerEvent: "kickoff",
              offsetValue: 5,
              offsetUnit: "business_days",
              evidenceSpans: [
                { startLine: 9, endLine: 9, evidenceRole: "ACTOR" },
                { startLine: 10, endLine: 10, evidenceRole: "ACTION" },
                { startLine: 10, endLine: 10, evidenceRole: "TIMING" },
              ],
            }),
          ],
        },
      ],
    });

    expect(result.confirmed[0]?.responsibleParty).toMatchObject({
      roleLabel: "Provider",
      canonicalName: "Acme Network Corporation",
      resolutionMethod: "INHERITED_FROM_ADJACENT_CONTEXT",
    });
  });

  it("keeps a defined payment term unchanged and includes only relevant definitions", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { llm, result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [{ candidates: [candidate()] }],
    });

    expect(result.confirmed[0]?.referencedTerms).toEqual(["Fees"]);
    expect(result.confirmed[0]?.object).toBe("Fees");
    expect(llm.prompts[0]?.prompt).toContain("- Fees:");
    expect(llm.prompts[0]?.prompt).not.toContain("Privacy Laws");
  });

  it("keeps payment timing from the following sentence in the same candidate", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [{ candidates: [candidate()] }],
    });

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.verifiedEvidenceSpans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startLine: 6, evidenceRole: "ACTION" }),
        expect.objectContaining({ startLine: 7, evidenceRole: "TIMING" }),
      ]),
    );
  });

  it("adds deterministic action evidence for payment candidates that cite only timing", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [
        {
          candidates: [
            candidate({
              evidenceSpans: [{ startLine: 7, endLine: 7, evidenceRole: "TIMING" }],
            }),
          ],
        },
      ],
    });

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.verifiedEvidenceSpans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startLine: 6, evidenceRole: "ACTION" }),
        expect.objectContaining({ startLine: 7, evidenceRole: "TIMING" }),
      ]),
    );
  });

  it("marks unresolved other party references for review", async () => {
    const index = sourceIndex();
    const returnWindow = windowForLine(index, 13);
    const { result } = await extract({
      selectedWindows: [returnWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "POST_TERMINATION",
              timingType: "EVENT_TRIGGERED",
              responsibleParty: {
                explicitText: "other party",
                roleLabel: null,
                canonicalName: null,
                resolutionMethod: "UNRESOLVED",
                supportingEvidence: [{ startLine: 13, endLine: 13, evidenceRole: "ACTOR" }],
                confidence: 0.4,
                reviewReasons: ["Other party is ambiguous"],
              },
              action: "return",
              object: "equipment",
              summary: "The other party shall return equipment after termination.",
              triggerEvent: "termination",
              offsetValue: 10,
              evidenceSpans: [
                { startLine: 13, endLine: 13, evidenceRole: "ACTOR" },
                { startLine: 13, endLine: 13, evidenceRole: "ACTION" },
                { startLine: 13, endLine: 13, evidenceRole: "TIMING" },
              ],
              reviewRequired: true,
              reviewReasons: ["Other party is ambiguous"],
            }),
          ],
        },
      ],
    });

    expect(result.reviewRequired[0]?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(result.reviewRequired[0]?.responsibleParty.resolutionMethod).toBe("UNRESOLVED");
    expect(result.reviewRequired[0]?.reviewReasons).toContain("Other party is ambiguous");
  });

  it("marks unavailable Exhibit references for review", async () => {
    const index = sourceIndex();
    const onboardingWindow = windowForLine(index, 10);
    const { result } = await extract({
      selectedWindows: [onboardingWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "SERVICE_PERFORMANCE",
              action: "perform",
              object: "Services",
              summary: "Customer shall perform the Services.",
              crossReferences: ["Exhibit D"],
              referencedTerms: ["Services"],
              evidenceSpans: [{ startLine: 10, endLine: 10, evidenceRole: "ACTION" }],
            }),
          ],
        },
      ],
      selector: new RelevantContextSelector({ nearbyLineCount: 10 }),
    });

    expect(result.reviewRequired[0]?.crossReferences).toEqual(["Exhibit D"]);
    expect(result.reviewRequired[0]?.reviewReasons).toContain(
      "Cross-reference Exhibit D is unavailable or unresolved",
    );
  });

  it("drops unsupported model-added cross references instead of forcing review", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [
        {
          candidates: [
            candidate({
              crossReferences: ["Section 99(a)"],
            }),
          ],
        },
      ],
    });

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.crossReferences).toEqual([]);
  });

  it("supports multiple evidence spans for one obligation", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [{ candidates: [candidate()] }],
    });

    expect(result.confirmed[0]?.verifiedEvidenceSpans).toHaveLength(2);
  });

  it("excludes rights-only clauses", async () => {
    const index = sourceIndex();
    const rightsWindow = windowForLine(index, 11);
    const { result } = await extract({
      selectedWindows: [rightsWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "OTHER",
              timingType: "NO_EXPLICIT_DEADLINE",
              action: "request",
              object: "status meeting",
              summary: "Either party may request a status meeting.",
              evidenceSpans: [{ startLine: 11, endLine: 11, evidenceRole: "ACTION" }],
            }),
          ],
        },
      ],
    });

    expect(result.verifiedCandidates).toEqual([]);
    expect(result.rejected[0]?.reasons).toContain(
      "Candidate evidence is excluded by extraction scope",
    );
  });

  it("excludes definition-only clauses", async () => {
    const index = sourceIndex();
    const definitionWindow = windowForLine(index, 12);
    const { result } = await extract({
      selectedWindows: [definitionWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "OTHER",
              timingType: "NO_EXPLICIT_DEADLINE",
              action: "mean",
              object: "Affiliate",
              summary: "Affiliate shall mean any entity under common control.",
              evidenceSpans: [{ startLine: 12, endLine: 12, evidenceRole: "DEFINITION" }],
            }),
          ],
        },
      ],
    });

    expect(result.verifiedCandidates).toEqual([]);
    expect(result.rejected[0]?.label).toBe(
      "Affiliate shall mean any entity under common control.",
    );
  });

  it("marks low-confidence results for review", async () => {
    const index = sourceIndex();
    const insuranceWindow = windowForLine(index, 14);
    const { result } = await extract({
      selectedWindows: [insuranceWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "INSURANCE",
              timingType: "ONGOING",
              action: "maintain",
              object: "insurance certificates",
              summary: "Customer shall maintain insurance certificates during the Term.",
              evidenceSpans: [{ startLine: 14, endLine: 14, evidenceRole: "ACTION" }],
              confidence: 0.42,
            }),
          ],
        },
      ],
    });

    expect(result.reviewRequired[0]?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(result.reviewRequired[0]?.reviewReasons).toContain(
      "Candidate confidence is below review threshold",
    );
  });

  it("rejects single evidence spans that cross pages", async () => {
    const index = sourceIndex();
    const postTerminationWindow = windowForLine(index, 15);
    const { result } = await extract({
      selectedWindows: [postTerminationWindow],
      responses: [
        {
          candidates: [
            candidate({
              businessType: "POST_TERMINATION",
              timingType: "EVENT_TRIGGERED",
              responsibleParty: {
                explicitText: "Provider",
                roleLabel: null,
                canonicalName: null,
                resolutionMethod: "CONTRACT_PARTY_MAP",
                supportingEvidence: [{ startLine: 15, endLine: 15, evidenceRole: "ACTOR" }],
                confidence: 0.9,
                reviewReasons: [],
              },
              action: "submit",
              object: "final report",
              summary: "Provider shall submit a final report after termination.",
              triggerEvent: "termination",
              evidenceSpans: [{ startLine: 14, endLine: 15, evidenceRole: "ACTION" }],
            }),
          ],
        },
      ],
    });

    expect(result.verifiedCandidates).toEqual([]);
    expect(result.rejected[0]?.reasons).toContain(
      "Evidence span crosses pages and requires review",
    );
  });

  it("keeps stable candidate keys independent of candidate and evidence order", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const firstRun = await extract({
      selectedWindows: [paymentWindow],
      responses: [
        {
          candidates: [
            candidate({
              evidenceSpans: [
                { startLine: 7, endLine: 7, evidenceRole: "TIMING" },
                { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
              ],
            }),
            candidate({
              object: "Support Credits",
              summary: "Customer shall pay Support Credits within thirty days.",
              evidenceSpans: [
                { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
                { startLine: 7, endLine: 7, evidenceRole: "TIMING" },
              ],
            }),
          ],
        },
      ],
    });
    const secondRun = await extract({
      selectedWindows: [paymentWindow],
      responses: [
        {
          candidates: [
            candidate({
              object: "Support Credits",
              summary: "Customer shall pay Support Credits within thirty days.",
              evidenceSpans: [
                { startLine: 7, endLine: 7, evidenceRole: "TIMING" },
                { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
              ],
            }),
            candidate({
              evidenceSpans: [
                { startLine: 6, endLine: 6, evidenceRole: "ACTION" },
                { startLine: 7, endLine: 7, evidenceRole: "TIMING" },
              ],
            }),
          ],
        },
      ],
    });

    const firstKeys = firstRun.result.confirmed
      .map((item) => item.stableCandidateKey)
      .sort();
    const secondKeys = secondRun.result.confirmed
      .map((item) => item.stableCandidateKey)
      .sort();

    expect(secondKeys).toEqual(firstKeys);
    expect(new Set(firstKeys).size).toBe(2);
  });

  it("builds deterministic batches with maximum window and character constraints", () => {
    const index = sourceIndex();
    const detected = windows(index);
    const first = buildCandidateWindowBatches(detected, {
      maxWindowsPerBatch: 2,
      maxBatchInputCharacters: 10_000,
    });
    const second = buildCandidateWindowBatches([...detected].reverse(), {
      maxWindowsPerBatch: 2,
      maxBatchInputCharacters: 10_000,
    });

    expect(second.map((batch) => batch.id)).toEqual(first.map((batch) => batch.id));
    expect(first.every((batch) => batch.windows.length <= 2)).toBe(true);

    const characterBounded = buildCandidateWindowBatches(detected, {
      maxWindowsPerBatch: 10,
      maxBatchInputCharacters: 400,
    });
    expect(characterBounded.length).toBeGreaterThanOrEqual(first.length);
  });

  it("rejects an unknown returned window ID", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);

    await expect(
      extract({
        selectedWindows: [paymentWindow],
        responses: [{ windowResults: [{ windowId: "unknown", obligations: [] }] }],
      }),
    ).rejects.toThrow("Batch obligation extraction returned unknown window ID");
  });

  it("detects a missing window result", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);

    await expect(
      extract({
        selectedWindows: [paymentWindow],
        responses: [{ windowResults: [] }],
      }),
    ).rejects.toThrow("Batch obligation extraction omitted window results");
  });

  it("rejects candidate evidence outside its returned window", async () => {
    const index = sourceIndex();
    const paymentWindow = windowForLine(index, 6);
    const { result } = await extract({
      selectedWindows: [paymentWindow],
      responses: [
        {
          windowResults: [
            {
              windowId: paymentWindow.id,
              obligations: [
                candidate({
                  evidenceSpans: [{ startLine: 13, endLine: 13, evidenceRole: "ACTION" }],
                }),
              ],
            },
          ],
        },
      ],
    });

    expect(result.verifiedCandidates).toEqual([]);
    expect(result.rejected[0]?.reasons).toContain(
      "Candidate evidence is outside the returned window",
    );
  });
});
