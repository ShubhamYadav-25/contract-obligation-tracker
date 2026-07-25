/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import { FakeStructuredLlmClient } from "../../src/infrastructure/llm/fake-structured-llm-client.js";
import {
  ContractContextExtractor,
  ContractSourceIndex,
  RelevantContextSelector,
  detectCandidateWindows,
  type ContractSourceLineInput,
} from "../../src/modules/extraction/reference-aware/index.js";

/**
 * @description Performs the source index helper operation for this module.
 * @returns {ContractSourceIndex} Result of the source index operation.
 */
function sourceIndex(): ContractSourceIndex {
  const lines: readonly ContractSourceLineInput[] = [
    {
      globalLineNumber: 1,
      pageNumber: 1,
      pageLocalLineNumber: 1,
      text: "MASTER SERVICES AGREEMENT",
      sourceMethod: "PDF_TEXT",
    },
    {
      globalLineNumber: 2,
      pageNumber: 1,
      pageLocalLineNumber: 2,
      text: 'This Master Services Agreement is effective as of January 1, 2026 (the "Effective Date") by and between Acme Network Corporation, a Delaware corporation ("Acme", "Network"), and Beta Affiliate LLC ("Customer", "Affiliate").',
      sourceMethod: "PDF_TEXT",
    },
    {
      globalLineNumber: 3,
      pageNumber: 1,
      pageLocalLineNumber: 3,
      text: "Section 1. Definitions",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 4,
      pageNumber: 1,
      pageLocalLineNumber: 4,
      text: '"Affiliate" means any entity controlling, controlled by, or under common control with a party.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 5,
      pageNumber: 1,
      pageLocalLineNumber: 5,
      text: '"Services" has the meaning set forth in Exhibit D.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 6,
      pageNumber: 1,
      pageLocalLineNumber: 6,
      text: '"Privacy Laws" means all laws applicable to personal information.',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Definitions"],
    },
    {
      globalLineNumber: 7,
      pageNumber: 1,
      pageLocalLineNumber: 7,
      text: "Section 2. Term and Renewal",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Term and Renewal"],
    },
    {
      globalLineNumber: 8,
      pageNumber: 1,
      pageLocalLineNumber: 8,
      text: 'The Initial Term commences on February 1, 2026 (the "Commencement Date") and renews on each anniversary (each, a "Renewal Date").',
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Term and Renewal"],
    },
    {
      globalLineNumber: 9,
      pageNumber: 1,
      pageLocalLineNumber: 9,
      text: "Section 3. Reporting",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Reporting"],
    },
    {
      globalLineNumber: 10,
      pageNumber: 1,
      pageLocalLineNumber: 10,
      text: "Customer shall submit monthly reports using the Network portal.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Reporting"],
    },
    {
      globalLineNumber: 11,
      pageNumber: 1,
      pageLocalLineNumber: 11,
      text: "Section 4. Support",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Support"],
    },
    {
      globalLineNumber: 12,
      pageNumber: 1,
      pageLocalLineNumber: 12,
      text: "Affiliate must maintain support records.",
      sourceMethod: "PDF_TEXT",
      sectionPath: ["Support"],
    },
    {
      globalLineNumber: 13,
      pageNumber: 10,
      pageLocalLineNumber: 1,
      text: "Distant operational schedule text that should not be sent for context extraction.",
      sourceMethod: "PDF_TEXT",
    },
  ];

  return new ContractSourceIndex(lines);
}

/**
 * @description Performs the raw context helper operation for this module.
 * @param {Record<string, unknown>} overrides - Input value for overrides.
 * @returns {Record<string, unknown>} Result of the raw context operation.
 */
function rawContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    parties: [
      {
        roleLabel: "Provider",
        canonicalName: "Acme Network Corporation",
        aliases: ["Acme", "Network"],
        sourceSpan: { startLine: 2, endLine: 2 },
      },
      {
        roleLabel: "Customer",
        canonicalName: "Beta Affiliate LLC",
        aliases: ["Customer", "Affiliate"],
        sourceSpan: { startLine: 2, endLine: 2 },
      },
    ],
    definedTerms: [
      {
        term: "Affiliate",
        definition: "any entity controlling, controlled by, or under common control with a party",
        referencedSection: null,
        referencedExhibit: null,
        resolutionStatus: "RESOLVED",
        sourceSpan: { startLine: 4, endLine: 4 },
      },
      {
        term: "Services",
        definition: null,
        referencedSection: null,
        referencedExhibit: "Exhibit D",
        resolutionStatus: "UNRESOLVED",
        sourceSpan: { startLine: 5, endLine: 5 },
      },
      {
        term: "Privacy Laws",
        definition: "all laws applicable to personal information",
        referencedSection: null,
        referencedExhibit: null,
        resolutionStatus: "RESOLVED",
        sourceSpan: { startLine: 6, endLine: 6 },
      },
    ],
    keyDates: [
      {
        label: "Effective Date",
        rawValue: "January 1, 2026",
        normalizedValue: "2026-01-01",
        sourceSpan: { startLine: 2, endLine: 2 },
      },
      {
        label: "Commencement Date",
        rawValue: "February 1, 2026",
        normalizedValue: "2026-02-01",
        sourceSpan: { startLine: 8, endLine: 8 },
      },
      {
        label: "Renewal Date",
        rawValue: "each anniversary",
        normalizedValue: null,
        sourceSpan: { startLine: 8, endLine: 8 },
      },
    ],
    sectionHeadings: [],
    ...overrides,
  };
}

/**
 * @description Performs the extract context helper operation for this module.
 * @param {unknown} index - Input value for index.
 * @param {unknown} response - Input value for response.
 * @returns {Promise<unknown>} Result of the extract context operation.
 */
async function extractContext(index = sourceIndex(), response = rawContext()) {
  const llm = new FakeStructuredLlmClient();
  llm.queueResponse("contract_context_extraction", response);
  const extractor = new ContractContextExtractor({
    llm,
    config: {
      introductoryPageCount: 1,
      maxPromptLineCount: 12,
      maxPromptCharacters: 4_000,
    },
  });

  return {
    llm,
    result: await extractor.extract({ sourceIndex: index }),
  };
}

describe("ContractContextExtractor", () => {
  it("resolves the Network alias to its canonical corporation", async () => {
    const { result } = await extractContext();
    const network = result.parties.find((party) => party.aliases.includes("Network"));

    expect(network?.canonicalName).toBe("Acme Network Corporation");
    expect(network?.roleLabel).toBe("Provider");
    expect(network?.sourceReference.exactQuote).toContain("Acme Network Corporation");
  });

  it("resolves the Affiliate alias correctly", async () => {
    const { result } = await extractContext();
    const affiliate = result.parties.find((party) => party.aliases.includes("Affiliate"));

    expect(affiliate?.canonicalName).toBe("Beta Affiliate LLC");
    expect(affiliate?.roleLabel).toBe("Customer");
  });

  it("indexes a capitalized defined term", async () => {
    const { result } = await extractContext();
    const services = result.definedTerms.find((term) => term.term === "Services");

    expect(services?.source).toEqual({
      pageNumber: 1,
      startLine: 5,
      endLine: 5,
    });
  });

  it("keeps has-the-meaning-in-Exhibit-D as a cross-reference", async () => {
    const { result } = await extractContext();
    const services = result.definedTerms.find((term) => term.term === "Services");

    expect(services).toMatchObject({
      definition: null,
      referencedExhibit: "Exhibit D",
      resolutionStatus: "UNRESOLVED",
    });
    expect(services?.sourceReference.exactQuote).toBe(
      '"Services" has the meaning set forth in Exhibit D.',
    );
  });

  it("rejects invalid source lines", async () => {
    const { result } = await extractContext(sourceIndex(), {
      ...rawContext(),
      parties: [
        {
          roleLabel: "Ghost",
          canonicalName: "Missing Party Inc.",
          aliases: ["Missing"],
          sourceSpan: { startLine: 99, endLine: 100 },
        },
      ],
    });

    expect(result.parties).toEqual([]);
    expect(result.rejectedItems).toEqual([
      expect.objectContaining({
        type: "party",
        label: "Missing Party Inc.",
        startLine: 99,
        endLine: 100,
      }),
    ]);
  });

  it("omits irrelevant definitions from a window prompt context", async () => {
    const index = sourceIndex();
    const { result } = await extractContext(index);
    const reportingWindow = detectCandidateWindows(index).find((window) =>
      window.targetGlobalLines.includes(10),
    );
    const selection = new RelevantContextSelector({ nearbyLineCount: 0 }).select({
      window: reportingWindow!,
      context: result,
      sourceIndex: index,
    });

    expect(selection.canonicalPartyMap).toHaveLength(2);
    expect(selection.parties.map((party) => party.canonicalName)).toEqual([
      "Acme Network Corporation",
      "Beta Affiliate LLC",
    ]);
    expect(selection.definedTerms).toEqual([]);
  });

  it("includes a party when an alias appears near a candidate window", async () => {
    const index = sourceIndex();
    const { result } = await extractContext(index);
    const affiliateWindow = detectCandidateWindows(index).find((window) =>
      window.targetGlobalLines.includes(12),
    );
    const selection = new RelevantContextSelector({ nearbyLineCount: 0 }).select({
      window: affiliateWindow!,
      context: result,
      sourceIndex: index,
    });

    expect(selection.parties.map((party) => party.canonicalName)).toEqual(["Beta Affiliate LLC"]);
  });

  it("does not send the whole document in one context request", async () => {
    const { llm } = await extractContext();
    const prompt = llm.prompts[0]?.prompt ?? "";

    expect(prompt).toContain("G1 P1:L1");
    expect(prompt).toContain("G8 P1:L8");
    expect(prompt).not.toContain("G13 P10:L1");
  });

  it("does not extract section headings when structure is already supplied", async () => {
    const { result } = await extractContext(sourceIndex(), {
      ...rawContext(),
      sectionHeadings: [
        {
          heading: "Section 3. Reporting",
          sectionPath: ["Reporting"],
          sourceSpan: { startLine: 9, endLine: 9 },
        },
      ],
    });

    expect(result.sectionHeadings).toEqual([]);
  });

  it("does not produce obligations", async () => {
    const { result } = await extractContext();

    expect("obligations" in result).toBe(false);
    expect("rawCandidates" in result).toBe(false);
  });
});
