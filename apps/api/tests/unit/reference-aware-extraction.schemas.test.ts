/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import {
  contractPartySchema,
  definedTermSchema,
  evidenceSpanCandidateSchema,
  partyResolutionSchema,
  rawObligationCandidateSchema,
  verifiedEvidenceSpanSchema,
} from "../../src/modules/extraction/reference-aware/index.js";

const sourceRange = {
  pageNumber: 1,
  startLine: 3,
  endLine: 4,
};

const evidenceSpan = {
  pageNumber: 1,
  startLine: 3,
  endLine: 4,
  evidenceRole: "ACTION",
} as const;

const unresolvedParty = {
  explicitText: null,
  roleLabel: null,
  canonicalName: null,
  resolutionMethod: "UNRESOLVED",
  supportingEvidence: [],
  confidence: 0.2,
  reviewReasons: ["Responsible party is not explicit"],
} as const;

const resolvedParty = {
  explicitText: "Vendor",
  roleLabel: "Vendor",
  canonicalName: "Vendor LLC",
  resolutionMethod: "EXPLICIT_IN_SENTENCE",
  supportingEvidence: [
    {
      pageNumber: 1,
      startLine: 3,
      endLine: 3,
      evidenceRole: "ACTOR",
    },
  ],
  confidence: 0.95,
  reviewReasons: [],
} as const;

/**
 * @description Performs the raw candidate helper operation for this module.
 * @param {Record<string, unknown>} overrides - Input value for overrides.
 * @returns {unknown} Result of the raw candidate operation.
 */
function rawCandidate(overrides: Record<string, unknown> = {}) {
  return {
    businessType: "REPORTING",
    timingType: "RELATIVE_DEADLINE",
    responsibleParty: unresolvedParty,
    counterparty: null,
    action: "deliver",
    object: "monthly reports",
    summary: "Vendor shall deliver monthly reports.",
    explicitDueDate: null,
    triggerEvent: "month end",
    referenceDateLabel: null,
    offsetValue: 10,
    offsetUnit: "days",
    offsetDirection: "after",
    frequency: null,
    duration: null,
    referencedTerms: [],
    crossReferences: [],
    evidenceSpans: [evidenceSpan],
    confidence: 0.8,
    reviewRequired: false,
    reviewReasons: [],
    ...overrides,
  };
}

describe("reference-aware extraction schemas", () => {
  it("accepts a valid ContractParty", () => {
    expect(() =>
      contractPartySchema.parse({
        roleLabel: "Vendor",
        canonicalName: "Vendor LLC",
        aliases: ["Supplier"],
        source: sourceRange,
      }),
    ).not.toThrow();
  });

  it("accepts a valid DefinedTerm with a referenced Exhibit and null definition", () => {
    expect(() =>
      definedTermSchema.parse({
        term: "Service Levels",
        definition: null,
        referencedSection: null,
        referencedExhibit: "Exhibit A",
        resolutionStatus: "RESOLVED",
        source: sourceRange,
      }),
    ).not.toThrow();
  });

  it("accepts a valid single-page evidence span", () => {
    expect(() => evidenceSpanCandidateSchema.parse(evidenceSpan)).not.toThrow();
  });

  it("rejects source ranges with startLine greater than endLine", () => {
    expect(() =>
      evidenceSpanCandidateSchema.parse({
        ...evidenceSpan,
        startLine: 5,
        endLine: 4,
      }),
    ).toThrow();
  });

  it("rejects pageNumber zero", () => {
    expect(() => evidenceSpanCandidateSchema.parse({ ...evidenceSpan, pageNumber: 0 })).toThrow();
  });

  it("rejects line number zero", () => {
    expect(() => evidenceSpanCandidateSchema.parse({ ...evidenceSpan, startLine: 0 })).toThrow();
  });

  it("accepts two evidence spans on different pages", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(
        rawCandidate({
          evidenceSpans: [
            evidenceSpan,
            {
              pageNumber: 2,
              startLine: 1,
              endLine: 2,
              evidenceRole: "TIMING",
            },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects raw evidence containing exactQuote", () => {
    expect(() =>
      evidenceSpanCandidateSchema.parse({
        ...evidenceSpan,
        exactQuote: "Vendor shall deliver reports.",
      }),
    ).toThrow();
  });

  it("rejects confidence below 0", () => {
    expect(() => rawObligationCandidateSchema.parse(rawCandidate({ confidence: -0.1 }))).toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() => rawObligationCandidateSchema.parse(rawCandidate({ confidence: 1.1 }))).toThrow();
  });

  it("rejects missing action", () => {
    const { action: _action, ...candidate } = rawCandidate();

    expect(() => rawObligationCandidateSchema.parse(candidate)).toThrow();
  });

  it("rejects blank action", () => {
    expect(() => rawObligationCandidateSchema.parse(rawCandidate({ action: "   " }))).toThrow();
  });

  it("accepts nullable timing fields", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(
        rawCandidate({
          explicitDueDate: null,
          triggerEvent: null,
          referenceDateLabel: null,
          offsetValue: null,
          offsetUnit: null,
          offsetDirection: null,
          frequency: null,
          duration: null,
        }),
      ),
    ).not.toThrow();
  });

  it("rejects unknown business type", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(rawCandidate({ businessType: "ESCALATION" })),
    ).toThrow();
  });

  it("rejects unknown timing type", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(rawCandidate({ timingType: "SOON" })),
    ).toThrow();
  });

  it("rejects unknown extra model fields", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(rawCandidate({ exactQuote: "text" })),
    ).toThrow();
  });

  it("rejects reviewRequired=true with no reviewReasons", () => {
    expect(() =>
      rawObligationCandidateSchema.parse(rawCandidate({ reviewRequired: true, reviewReasons: [] })),
    ).toThrow();
  });

  it("allows AMBIGUOUS party resolution with null canonicalName", () => {
    expect(() =>
      partyResolutionSchema.parse({
        explicitText: "Supplier",
        roleLabel: null,
        canonicalName: null,
        resolutionMethod: "AMBIGUOUS",
        supportingEvidence: [],
        confidence: 0.4,
        reviewReasons: ["Supplier may refer to multiple parties"],
      }),
    ).not.toThrow();
  });

  it("rejects resolved party resolution without a roleLabel", () => {
    expect(() =>
      partyResolutionSchema.parse({
        ...resolvedParty,
        roleLabel: null,
      }),
    ).toThrow();
  });

  it("accepts VerifiedEvidenceSpan with a deterministically reconstructed quote", () => {
    expect(() =>
      verifiedEvidenceSpanSchema.parse({
        pageNumber: 1,
        startLine: 3,
        endLine: 4,
        evidenceRole: "ACTION",
        exactQuote: "Vendor shall deliver monthly reports.",
        normalizedQuote: "Vendor shall deliver monthly reports.",
        verificationErrors: [],
      }),
    ).not.toThrow();
  });
});
