/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import type { ParsedDocumentPage } from "../../src/modules/document-processing/document-processing.types.js";
import { ContractSourceIndex } from "../../src/modules/extraction/reference-aware/index.js";

/**
 * @description Performs the page helper operation for this module.
 * @param {{ readonly pageNumber: number; readonly lines: readonly string[]; readonly extractionMethod?: "PDF_TEXT" | "TESSERACT" | "GEMINI_VISION"; }} input - Input value for input.
 * @returns {ParsedDocumentPage} Result of the page operation.
 */
function page(input: {
  readonly pageNumber: number;
  readonly lines: readonly string[];
  readonly extractionMethod?: "PDF_TEXT" | "TESSERACT" | "GEMINI_VISION";
}): ParsedDocumentPage {
  const normalizedText = input.lines.join("\n");
  return {
    documentId: "00000000-0000-4000-8000-000000000001",
    pageNumber: input.pageNumber,
    text: normalizedText,
    lines: input.lines.map((text, index) => ({
      pageNumber: input.pageNumber,
      lineNumber: index + 1,
      text,
    })),
    rawText: normalizedText,
    normalizedText,
    textItems: input.lines.map((text) => ({ pageNumber: input.pageNumber, text })),
    charCount: normalizedText.length,
    wordCount: normalizedText.split(/\s+/).filter(Boolean).length,
    printableRatio: 1,
    extractionMethod: input.extractionMethod ?? "PDF_TEXT",
    warnings: [],
  };
}

describe("ContractSourceIndex", () => {
  it("resolves global lines 632-634 to the actual page, never page 634", () => {
    const index = ContractSourceIndex.fromParsedPages([
      page({
        pageNumber: 1,
        lines: Array.from({ length: 631 }, (_, lineIndex) => `Page 1 line ${lineIndex + 1}`),
      }),
      page({
        pageNumber: 2,
        lines: ["Page 2 line 1", "Page 2 line 2", "Page 2 line 3", "Page 2 line 4"],
      }),
    ]);

    const resolved = index.resolveEvidenceSpan(632, 634);

    expect(resolved.verificationErrors).toEqual([]);
    expect(resolved.startPage).toBe(2);
    expect(resolved.endPage).toBe(2);
    expect(resolved.sourceLines.map((line) => line.pageLocalLineNumber)).toEqual([1, 2, 3]);
    expect(resolved.sourceLines.every((line) => line.pageNumber !== 634)).toBe(true);
  });

  it("resolves a multi-page span", () => {
    const index = ContractSourceIndex.fromParsedPages([
      page({ pageNumber: 10, lines: ["A", "B"] }),
      page({ pageNumber: 11, lines: ["C", "D"] }),
    ]);

    const resolved = index.resolveEvidenceSpan(2, 3);

    expect(resolved.startPage).toBe(10);
    expect(resolved.endPage).toBe(11);
    expect(resolved.exactQuote).toBe("B\nC");
  });

  it("returns a deterministic error for a missing start line", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        pageLocalLineNumber: 1,
        text: "Line 1",
        sourceMethod: "PDF_TEXT",
      },
      {
        globalLineNumber: 3,
        pageNumber: 1,
        pageLocalLineNumber: 3,
        text: "Line 3",
        sourceMethod: "PDF_TEXT",
      },
    ]);

    const resolved = index.resolveEvidenceSpan(2, 3);

    expect(resolved.verificationErrors.map((item) => item.code)).toContain("MISSING_START_LINE");
    expect(resolved.exactQuote).toBe("Line 3");
  });

  it("returns a deterministic error for a missing middle line", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        pageLocalLineNumber: 1,
        text: "Line 1",
        sourceMethod: "PDF_TEXT",
      },
      {
        globalLineNumber: 3,
        pageNumber: 1,
        pageLocalLineNumber: 3,
        text: "Line 3",
        sourceMethod: "PDF_TEXT",
      },
    ]);

    const resolved = index.resolveEvidenceSpan(1, 3);

    expect(resolved.verificationErrors.map((item) => item.code)).toContain("MISSING_GLOBAL_LINE");
    expect(resolved.exactQuote).toBe("Line 1\nLine 3");
  });

  it("rejects a reversed span", () => {
    const index = ContractSourceIndex.fromParsedPages([page({ pageNumber: 1, lines: ["A"] })]);

    const resolved = index.resolveEvidenceSpan(5, 4);

    expect(resolved.verificationErrors).toEqual([
      expect.objectContaining({ code: "REVERSED_SPAN", startLine: 5, endLine: 4 }),
    ]);
    expect(resolved.exactQuote).toBe("");
  });

  it("removes exact duplicate spans while keeping evidence roles", () => {
    const index = ContractSourceIndex.fromParsedPages([page({ pageNumber: 1, lines: ["A", "B"] })]);

    const resolved = index.resolveEvidenceSpans([
      { startLine: 1, endLine: 1, evidenceRole: "ACTION" },
      { startLine: 1, endLine: 1, evidenceRole: "ACTION" },
      { startLine: 1, endLine: 1, evidenceRole: "OBJECT" },
    ]);

    expect(resolved).toHaveLength(2);
    expect(resolved.map((span) => span.evidenceRole)).toEqual(["ACTION", "OBJECT"]);
  });

  it("keeps two non-contiguous evidence spans separate", () => {
    const index = ContractSourceIndex.fromParsedPages([
      page({ pageNumber: 1, lines: ["A", "B", "C", "D"] }),
    ]);

    const resolved = index.resolveEvidenceSpans([
      { startLine: 1, endLine: 1, evidenceRole: "ACTION" },
      { startLine: 3, endLine: 4, evidenceRole: "TIMING" },
    ]);

    expect(resolved).toHaveLength(2);
    expect(resolved.map((span) => span.exactQuote)).toEqual(["A", "C\nD"]);
  });

  it("reconstructs exact quotes from normalized source lines", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        pageLocalLineNumber: 1,
        text: "  Vendor\t\tshall   deliver reports.  ",
        sourceMethod: "PDF_TEXT",
      },
      {
        globalLineNumber: 2,
        pageNumber: 1,
        pageLocalLineNumber: 2,
        text: "Customer shall review them.",
        sourceMethod: "PDF_TEXT",
      },
    ]);

    const resolved = index.resolveEvidenceSpan(1, 2);

    expect(resolved.exactQuote).toBe("Vendor shall deliver reports.\nCustomer shall review them.");
    expect(resolved.sourceLines[0]?.originalText).toBe("  Vendor\t\tshall   deliver reports.  ");
  });

  it("supports OCR-produced lines using the existing source type", () => {
    const index = ContractSourceIndex.fromParsedPages([
      page({
        pageNumber: 7,
        lines: ["OCR line one", "OCR line two"],
        extractionMethod: "TESSERACT",
      }),
    ]);

    const resolved = index.resolveEvidenceSpan(1, 2);

    expect(resolved.startPage).toBe(7);
    expect(resolved.sourceLines.map((line) => line.sourceMethod)).toEqual([
      "TESSERACT",
      "TESSERACT",
    ]);
    expect(resolved.exactQuote).toBe("OCR line one\nOCR line two");
  });

  it("records duplicate and missing global line diagnostics", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        text: "Line 1",
        sourceMethod: "PDF_TEXT",
      },
      {
        globalLineNumber: 1,
        pageNumber: 1,
        text: "Duplicate line 1",
        sourceMethod: "PDF_TEXT",
      },
      {
        globalLineNumber: 3,
        pageNumber: 1,
        text: "Line 3",
        sourceMethod: "PDF_TEXT",
      },
    ]);

    expect(index.diagnostics.map((item) => item.code)).toEqual([
      "DUPLICATE_GLOBAL_LINE",
      "MISSING_GLOBAL_LINE",
    ]);
  });
});
