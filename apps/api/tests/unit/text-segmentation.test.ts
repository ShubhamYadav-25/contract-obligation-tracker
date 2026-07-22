import { describe, expect, it } from "vitest";

import { evaluateTextQuality } from "../../src/modules/document-processing/document-quality.js";
import type { ParsedDocumentPage } from "../../src/modules/document-processing/document-processing.types.js";
import { segmentDocumentPages } from "../../src/modules/document-processing/text-segmentation.js";
import { splitPageLines } from "../../src/modules/document-processing/text-normalizer.js";

function page(pageNumber: number, text: string): ParsedDocumentPage {
  const quality = evaluateTextQuality(text, {
    minCharacters: 1,
    minWords: 1,
    minPrintableRatio: 0.1,
    maxIsolatedTokenRatio: 1,
  });

  return {
    documentId: "00000000-0000-4000-8000-000000000001",
    pageNumber,
    text,
    lines: splitPageLines(pageNumber, text),
    rawText: text,
    normalizedText: text,
    textItems: [{ pageNumber, text }],
    charCount: quality.charCount,
    wordCount: quality.wordCount,
    printableRatio: quality.printableRatio,
    extractionMethod: "PDF_TEXT",
    warnings: [],
  };
}

describe("text segmentation", () => {
  it("preserves page ordering, line ranges, and offsets", () => {
    const pages = segmentDocumentPages(
      [
        page(1, "Section 1. Payment is due.\nSection 1.1. Fees are monthly."),
        page(2, "Section 2. Confidentiality survives termination."),
      ],
      { maxSegmentCharacters: 40, lineOverlap: 0 },
    );

    expect(pages[0]?.segments.map((segment) => segment.pageNumber)).toEqual([1, 1]);
    expect(pages[1]?.segments.every((segment) => segment.pageNumber === 2)).toBe(true);
    expect(pages[0]?.segments[0]).toMatchObject({
      lineStart: 1,
      lineEnd: 1,
      startOffset: 0,
      extractionMethod: "PDF_TEXT",
    });
    expect(pages[0]?.segments[1]?.startOffset).toBeGreaterThan(
      pages[0]?.segments[0]?.endOffset ?? 0,
    );
  });
});
