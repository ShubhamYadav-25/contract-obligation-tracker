/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, it, expect } from "vitest";
import { extractFieldsFromPages } from "../../src/modules/extraction/heuristics.js";

describe("heuristics.extractFieldsFromPages", () => {
  it("extracts parties, contract value, term, renewal and notice from sample pages", () => {
    const pages = [
      {
        pageNumber: 1,
        rawText: `This Agreement is entered into between Alpha Corp ("Alpha") and Beta LLC ("Beta").\nThe Total Contract Value: $1,200,000.00\nTerm: 3 years commencing on 1 January 2024\nThis Agreement will automatically renew for successive one-year terms.\nEither party may terminate by giving 90 days' notice.`,
      },
    ];

    const { extraction, confidence } = extractFieldsFromPages(pages as any);

    expect(extraction.parties).toBeDefined();
    expect(extraction.contractValue).toBeDefined();
    expect(extraction.contractValue!.amount).toBe(1200000);
    expect(extraction.term).toBeDefined();
    expect(extraction.term!.durationMonths).toBe(36);
    expect(extraction.renewal).toBeDefined();
    expect(extraction.noticePeriod).toBeDefined();
    expect(extraction.noticePeriod!.days).toBe(90);
    expect(confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("returns lower confidence when fields are not found", () => {
    const pages = [{ pageNumber: 1, rawText: `Some unrelated text with no parties or amounts.` }];
    const { extraction, confidence } = extractFieldsFromPages(pages as any);
    expect(extraction.parties).toBeUndefined();
    expect(extraction.contractValue).toBeUndefined();
    expect(confidence).toBeLessThan(0.85);
  });
});
