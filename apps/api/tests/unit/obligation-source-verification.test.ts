import { describe, expect, it } from "vitest";

import {
  ContractSourceIndex,
  ObligationConsolidator,
  ObligationDeduplicator,
  ObligationSourceVerifier,
  type ContractSourceLineInput,
  type DetectedCandidateWindow,
  type VerifiedObligationCandidate,
} from "../../src/modules/extraction/reference-aware/index.js";

function sourceIndex(): ContractSourceIndex {
  const lines: readonly ContractSourceLineInput[] = [
    {
      globalLineNumber: 1,
      pageNumber: 1,
      pageLocalLineNumber: 1,
      text: "Section 2. Payment",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 2,
      pageNumber: 1,
      pageLocalLineNumber: 2,
      text: "Customer shall pay the Fees.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 3,
      pageNumber: 1,
      pageLocalLineNumber: 3,
      text: "Payment is due within thirty (30) days after receipt of invoice.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 4,
      pageNumber: 1,
      pageLocalLineNumber: 4,
      text: "Customer shall pay the Advertising Share monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 5,
      pageNumber: 1,
      pageLocalLineNumber: 5,
      text: "Customer shall pay the Transactional Share monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 6,
      pageNumber: 1,
      pageLocalLineNumber: 6,
      text: '"Fees" shall mean amounts listed in Order Form A.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 7,
      pageNumber: 2,
      pageLocalLineNumber: 1,
      text: "Provider shall deliver monthly reports.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Reports"],
    },
    {
      globalLineNumber: 8,
      pageNumber: 2,
      pageLocalLineNumber: 2,
      text: "Customer shall pay the Support Fee monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Support Fees"],
    },
    {
      globalLineNumber: 9,
      pageNumber: 2,
      pageLocalLineNumber: 3,
      text: "Customer shall pay the Support Fee monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Operations Fees"],
    },
    {
      globalLineNumber: 10,
      pageNumber: 2,
      pageLocalLineNumber: 4,
      text: "Customer shall pay the Platform Fee monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
    {
      globalLineNumber: 11,
      pageNumber: 2,
      pageLocalLineNumber: 5,
      text: "Customer shall pay the Support Fee monthly.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Payment"],
    },
  ];

  return new ContractSourceIndex(lines);
}

function windowFor(
  index: ContractSourceIndex,
  input: { readonly id: string; readonly start: number; readonly end: number },
): DetectedCandidateWindow {
  const sourceLines = index.lines.filter(
    (line) => line.globalLineNumber >= input.start && line.globalLineNumber <= input.end,
  );
  const firstLine = sourceLines[0];
  if (!firstLine) {
    throw new Error(`Missing test window line ${input.start}`);
  }

  return {
    id: input.id,
    globalStartLine: input.start,
    globalEndLine: input.end,
    targetGlobalLines: [input.start],
    contextSpans: [],
    targetSpans: [
      {
        pageNumber: firstLine.pageNumber,
        startLine: firstLine.pageLocalLineNumber ?? firstLine.globalLineNumber,
        endLine: firstLine.pageLocalLineNumber ?? firstLine.globalLineNumber,
      },
    ],
    sectionPath: firstLine.sectionPath,
    cueTypes: ["shall"],
    characterCount: sourceLines.reduce((count, line) => count + line.normalizedText.length, 0),
    sourceMethod: firstLine.sourceMethod,
    sourceLines,
  };
}

function customerParty(overrides: Partial<VerifiedObligationCandidate["responsibleParty"]> = {}) {
  return {
    explicitText: "Customer",
    roleLabel: "Customer",
    canonicalName: "Beta Affiliate LLC",
    resolutionMethod: "CONTRACT_PARTY_MAP",
    supportingEvidence: [{ pageNumber: 1, startLine: 2, endLine: 2, evidenceRole: "ACTOR" }],
    confidence: 0.91,
    reviewReasons: [],
    ...overrides,
  } satisfies VerifiedObligationCandidate["responsibleParty"];
}

function candidate(
  overrides: Partial<VerifiedObligationCandidate> = {},
): VerifiedObligationCandidate {
  return {
    businessType: "PAYMENT",
    timingType: "RELATIVE_DEADLINE",
    responsibleParty: customerParty(),
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
    verifiedEvidenceSpans: [
      {
        pageNumber: 1,
        startLine: 2,
        endLine: 2,
        evidenceRole: "ACTOR",
        exactQuote: "model quote ignored",
        normalizedQuote: "model quote ignored",
        verificationErrors: [],
      },
      {
        pageNumber: 1,
        startLine: 2,
        endLine: 2,
        evidenceRole: "ACTION",
        exactQuote: "model quote ignored",
        normalizedQuote: "model quote ignored",
        verificationErrors: [],
      },
      {
        pageNumber: 1,
        startLine: 3,
        endLine: 3,
        evidenceRole: "TIMING",
        exactQuote: "model quote ignored",
        normalizedQuote: "model quote ignored",
        verificationErrors: [],
      },
    ],
    confidence: 0.91,
    reviewStatus: "CONFIRMED",
    reviewReasons: [],
    stableCandidateKey: "candidate_payment",
    ...overrides,
  };
}

function verify(
  index: ContractSourceIndex,
  items: readonly { readonly candidate: VerifiedObligationCandidate; readonly window: DetectedCandidateWindow }[],
) {
  return new ObligationSourceVerifier({ confidenceThreshold: 0.7 }).verify({
    sourceIndex: index,
    items,
  });
}

describe("ObligationSourceVerifier", () => {
  it("deduplicates obligations produced by overlapping windows", () => {
    const index = sourceIndex();
    const first = windowFor(index, { id: "first", start: 1, end: 3 });
    const second = windowFor(index, { id: "second", start: 2, end: 3 });
    const result = verify(index, [
      { candidate: candidate({ stableCandidateKey: "candidate_first" }), window: first },
      { candidate: candidate({ stableCandidateKey: "candidate_second" }), window: second },
    ]);

    const deduplicated = new ObligationDeduplicator().deduplicate(result.verified);

    expect(result.confirmed).toHaveLength(2);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0]?.sourceCandidateKeys).toEqual([
      "candidate_first",
      "candidate_second",
    ]);
  });

  it("deduplicates identical line span and actor candidates", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const result = verify(index, [
      { candidate: candidate({ stableCandidateKey: "candidate_a" }), window: paymentWindow },
      { candidate: candidate({ stableCandidateKey: "candidate_b" }), window: paymentWindow },
    ]);

    expect(new ObligationDeduplicator().deduplicate(result.verified)).toHaveLength(1);
  });

  it("consolidates a payment action with a separate timing sentence", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const actionCandidate = candidate({
      timingType: "NO_EXPLICIT_DEADLINE",
      triggerEvent: null,
      offsetValue: null,
      offsetUnit: null,
      offsetDirection: null,
      summary: "Customer shall pay the Fees.",
      stableCandidateKey: "action_fragment",
      verifiedEvidenceSpans: [
        {
          pageNumber: 1,
          startLine: 2,
          endLine: 2,
          evidenceRole: "ACTOR",
          exactQuote: "ignored",
          normalizedQuote: "ignored",
          verificationErrors: [],
        },
        {
          pageNumber: 1,
          startLine: 2,
          endLine: 2,
          evidenceRole: "ACTION",
          exactQuote: "ignored",
          normalizedQuote: "ignored",
          verificationErrors: [],
        },
      ],
    });
    const timingCandidate = candidate({
      stableCandidateKey: "timing_fragment",
      summary: "Payment is due within thirty days after receipt of invoice.",
      verifiedEvidenceSpans: [
        {
          pageNumber: 1,
          startLine: 3,
          endLine: 3,
          evidenceRole: "ACTION",
          exactQuote: "ignored",
          normalizedQuote: "ignored",
          verificationErrors: [],
        },
        {
          pageNumber: 1,
          startLine: 3,
          endLine: 3,
          evidenceRole: "TIMING",
          exactQuote: "ignored",
          normalizedQuote: "ignored",
          verificationErrors: [],
        },
        {
          pageNumber: 1,
          startLine: 3,
          endLine: 3,
          evidenceRole: "TIMING",
          exactQuote: "ignored duplicate",
          normalizedQuote: "ignored duplicate",
          verificationErrors: [],
        },
      ],
    });

    const result = verify(index, [
      { candidate: actionCandidate, window: paymentWindow },
      { candidate: timingCandidate, window: paymentWindow },
    ]);
    const consolidated = new ObligationConsolidator().consolidate(result.verified);

    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]?.sourceEvidence.map((span) => span.evidenceRole)).toEqual([
      "ACTOR",
      "ACTION",
      "ACTION",
      "TIMING",
    ]);
    expect(consolidated[0]?.offsetValue).toBe(30);
    expect(
      consolidated[0]?.sourceEvidence.map((span) => [
        span.evidenceRole,
        span.globalStartLine,
        span.globalEndLine,
      ]),
    ).toEqual([
      ["ACTOR", 2, 2],
      ["ACTION", 2, 2],
      ["ACTION", 3, 3],
      ["TIMING", 3, 3],
    ]);
  });

  it("keeps Advertising Share and Transactional Share separate", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "shares", start: 4, end: 5 });
    const result = verify(index, [
      {
        candidate: candidate({
          object: "Advertising Share",
          summary: "Customer shall pay the Advertising Share monthly.",
          frequency: "monthly",
          stableCandidateKey: "advertising_share",
          verifiedEvidenceSpans: [
            {
              pageNumber: 1,
              startLine: 4,
              endLine: 4,
              evidenceRole: "ACTOR",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
            {
              pageNumber: 1,
              startLine: 4,
              endLine: 4,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
      {
        candidate: candidate({
          object: "Transactional Share",
          summary: "Customer shall pay the Transactional Share monthly.",
          frequency: "monthly",
          stableCandidateKey: "transactional_share",
          verifiedEvidenceSpans: [
            {
              pageNumber: 1,
              startLine: 5,
              endLine: 5,
              evidenceRole: "ACTOR",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
            {
              pageNumber: 1,
              startLine: 5,
              endLine: 5,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
    ]);

    expect(new ObligationConsolidator().consolidate(result.verified)).toHaveLength(2);
  });

  it("keeps same actor and frequency separate when obligation objects differ", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment_objects", start: 10, end: 11 });
    const result = verify(index, [
      {
        candidate: candidate({
          object: "Platform Fee",
          summary: "Customer shall pay the Platform Fee monthly.",
          frequency: "monthly",
          stableCandidateKey: "platform_fee",
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 4,
              endLine: 4,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
      {
        candidate: candidate({
          object: "Support Fee",
          summary: "Customer shall pay the Support Fee monthly.",
          frequency: "monthly",
          stableCandidateKey: "support_fee",
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 5,
              endLine: 5,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
    ]);

    expect(new ObligationConsolidator().consolidate(result.verified)).toHaveLength(2);
  });

  it("does not consolidate similar obligations from separate sections", () => {
    const index = sourceIndex();
    const supportWindow = windowFor(index, { id: "support", start: 8, end: 8 });
    const operationsWindow = windowFor(index, { id: "operations", start: 9, end: 9 });
    const result = verify(index, [
      {
        candidate: candidate({
          object: "Support Fee",
          summary: "Customer shall pay the Support Fee monthly.",
          frequency: "monthly",
          stableCandidateKey: "support_section_fee",
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 2,
              endLine: 2,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: supportWindow,
      },
      {
        candidate: candidate({
          object: "Support Fee",
          summary: "Customer shall pay the Support Fee monthly.",
          frequency: "monthly",
          stableCandidateKey: "operations_section_fee",
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 3,
              endLine: 3,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: operationsWindow,
      },
    ]);

    expect(new ObligationConsolidator().consolidate(result.verified)).toHaveLength(2);
  });

  it("marks unresolved actors for review", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const result = verify(index, [
      {
        candidate: candidate({
          responsibleParty: customerParty({
            explicitText: "the other party",
            roleLabel: null,
            canonicalName: null,
            resolutionMethod: "UNRESOLVED",
            confidence: 0.2,
            reviewReasons: ["Other party is ambiguous"],
          }),
          reviewStatus: "REVIEW_REQUIRED",
          reviewReasons: ["Other party is ambiguous"],
        }),
        window: paymentWindow,
      },
    ]);

    expect(result.reviewRequired).toHaveLength(1);
    expect(result.reviewRequired[0]?.reviewReasons).toEqual(
      expect.arrayContaining(["Responsible party is unresolved", "Other party is ambiguous"]),
    );
  });

  it("rejects invalid source evidence", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const result = verify(index, [
      {
        candidate: candidate({
          verifiedEvidenceSpans: [
            {
              pageNumber: 9,
              startLine: 99,
              endLine: 99,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
    ]);

    expect(result.rejected[0]?.reviewStatus).toBe("REJECTED");
    expect(result.rejected[0]?.reviewReasons).toEqual(
      expect.arrayContaining(["Candidate has invalid source evidence"]),
    );
  });

  it("rejects evidence when a middle source line is missing", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        pageLocalLineNumber: 1,
        text: "Section 2. Payment",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Payment"],
      },
      {
        globalLineNumber: 2,
        pageNumber: 1,
        pageLocalLineNumber: 2,
        text: "Customer shall pay the Fees.",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Payment"],
      },
      {
        globalLineNumber: 4,
        pageNumber: 1,
        pageLocalLineNumber: 4,
        text: "Payment is due within thirty days.",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Payment"],
      },
    ]);
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 4 });
    const result = verify(index, [
      {
        candidate: candidate({
          verifiedEvidenceSpans: [
            {
              pageNumber: 1,
              startLine: 2,
              endLine: 4,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
    ]);

    expect(result.rejected[0]?.reviewReasons).toEqual(
      expect.arrayContaining([
        "Global line 3 is missing from the source span",
        "Candidate has invalid source evidence",
      ]),
    );
  });

  it("rejects evidence outside the supplied candidate window", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const result = verify(index, [
      {
        candidate: candidate({
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 1,
              endLine: 1,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: paymentWindow,
      },
    ]);

    expect(result.rejected[0]?.reviewReasons).toEqual(
      expect.arrayContaining([
        "Evidence 7-7 is outside candidate window 1-3",
        "Candidate has invalid source evidence",
      ]),
    );
  });

  it("rejects definition candidates", () => {
    const index = sourceIndex();
    const definitionWindow = windowFor(index, { id: "definition", start: 6, end: 6 });
    const result = verify(index, [
      {
        candidate: candidate({
          action: "mean",
          object: "Fees",
          summary: '"Fees" shall mean amounts listed in Order Form A.',
          stableCandidateKey: "definition_candidate",
          verifiedEvidenceSpans: [
            {
              pageNumber: 1,
              startLine: 6,
              endLine: 6,
              evidenceRole: "DEFINITION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: definitionWindow,
      },
    ]);

    expect(result.rejected[0]?.reviewReasons).toContain("Candidate is definition-only");
  });

  it("reconstructs exact pages and quotes from the source index", () => {
    const index = sourceIndex();
    const reportsWindow = windowFor(index, { id: "reports", start: 7, end: 7 });
    const result = verify(index, [
      {
        candidate: candidate({
          businessType: "REPORTING",
          timingType: "RECURRING",
          responsibleParty: customerParty({
            explicitText: "Provider",
            roleLabel: "Provider",
            canonicalName: "Acme Network Corporation",
            supportingEvidence: [{ pageNumber: 2, startLine: 1, endLine: 1, evidenceRole: "ACTOR" }],
          }),
          action: "deliver",
          object: "monthly reports",
          summary: "Provider shall deliver monthly reports.",
          frequency: "monthly",
          stableCandidateKey: "reports",
          verifiedEvidenceSpans: [
            {
              pageNumber: 2,
              startLine: 1,
              endLine: 1,
              evidenceRole: "ACTOR",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
            {
              pageNumber: 2,
              startLine: 1,
              endLine: 1,
              evidenceRole: "ACTION",
              exactQuote: "ignored",
              normalizedQuote: "ignored",
              verificationErrors: [],
            },
          ],
        }),
        window: reportsWindow,
      },
    ]);

    expect(result.confirmed[0]?.sourceEvidence[0]).toMatchObject({
      globalStartLine: 7,
      globalEndLine: 7,
      startPage: 2,
      endPage: 2,
      exactQuote: "Provider shall deliver monthly reports.",
    });
    expect(result.confirmed[0]?.sourceEvidence[0]?.exactQuote).not.toBe("ignored");
  });

  it("produces identical output and IDs when processing the same candidates twice", () => {
    const index = sourceIndex();
    const paymentWindow = windowFor(index, { id: "payment", start: 1, end: 3 });
    const input = [
      { candidate: candidate({ stableCandidateKey: "candidate_a" }), window: paymentWindow },
      { candidate: candidate({ stableCandidateKey: "candidate_b" }), window: paymentWindow },
    ];

    const run = () => {
      const verified = verify(index, input);
      const deduplicated = new ObligationDeduplicator().deduplicate(verified.verified);
      return new ObligationConsolidator().consolidate(deduplicated);
    };

    const first = run();
    const second = run();

    expect(second).toEqual(first);
    expect(second.map((obligation) => obligation.stableObligationId)).toEqual(
      first.map((obligation) => obligation.stableObligationId),
    );
    expect(new ObligationConsolidator().consolidate(first)).toEqual(first);
  });
});
