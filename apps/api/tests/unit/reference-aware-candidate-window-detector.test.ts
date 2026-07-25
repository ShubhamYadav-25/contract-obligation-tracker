/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ContractSourceIndex,
  detectCandidateWindows,
  renderCandidateWindowForLlm,
} from "../../src/modules/extraction/reference-aware/index.js";

/**
 * @description Performs the fixture index helper operation for this module.
 * @returns {ContractSourceIndex} Result of the fixture index operation.
 */
function fixtureIndex(): ContractSourceIndex {
  const fixturePath = path.resolve(
    process.cwd(),
    "../../datasets/contracts/reference-aware-candidate-window.txt",
  );
  const lines = readFileSync(fixturePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((text, index) => ({
      globalLineNumber: index + 1,
      pageNumber: 1,
      pageLocalLineNumber: index + 1,
      text,
      sourceMethod: "PDF_TEXT" as const,
    }));

  return new ContractSourceIndex(lines);
}

/**
 * @description Performs the target lines helper operation for this module.
 * @param {ContractSourceIndex} index - Input value for index.
 * @returns {unknown} Result of the target lines operation.
 */
function targetLines(index: ContractSourceIndex) {
  return detectCandidateWindows(index).flatMap((window) => window.targetGlobalLines);
}

describe("reference-aware candidate-window detector", () => {
  it("does not target a definition containing shall mean", () => {
    expect(targetLines(fixtureIndex())).not.toContain(2);
  });

  it("detects a payment sentence", () => {
    expect(targetLines(fixtureIndex())).toContain(4);
  });

  it("detects a renewal-notice sentence", () => {
    expect(targetLines(fixtureIndex())).toContain(9);
  });

  it("detects a recurring report sentence", () => {
    expect(targetLines(fixtureIndex())).toContain(7);
  });

  it("puts adjacent payer and timing sentences in the same window", () => {
    const windows = detectCandidateWindows(fixtureIndex());
    const paymentWindow = windows.find((window) => window.targetGlobalLines.includes(4));

    expect(paymentWindow?.targetGlobalLines).toEqual([4, 5]);
    expect(paymentWindow?.cueTypes).toEqual(
      expect.arrayContaining(["shall", "due", "within_time_period"]),
    );
  });

  it("merges overlapping windows", () => {
    const windows = detectCandidateWindows(fixtureIndex(), {
      precedingContextLineCount: 1,
      followingContextLineCount: 1,
      maxWindowLineCount: 8,
      maxWindowCharacters: 2_000,
      mergeGapLineCount: 0,
    });

    const mergedWindow = windows.find(
      (window) => window.targetGlobalLines.includes(4) && window.targetGlobalLines.includes(5),
    );

    expect(mergedWindow).toBeDefined();
    expect(mergedWindow?.globalStartLine).toBe(3);
    expect(mergedWindow?.globalEndLine).toBe(6);
  });

  it("does not merge distant clauses", () => {
    const windows = detectCandidateWindows(fixtureIndex(), {
      precedingContextLineCount: 0,
      followingContextLineCount: 0,
      maxWindowLineCount: 5,
      maxWindowCharacters: 2_000,
      mergeGapLineCount: 0,
    });
    const reportingWindow = windows.find((window) => window.targetGlobalLines.includes(7));
    const insuranceWindow = windows.find((window) => window.targetGlobalLines.includes(13));

    expect(reportingWindow).toBeDefined();
    expect(insuranceWindow).toBeDefined();
    expect(reportingWindow?.id).not.toBe(insuranceWindow?.id);
  });

  it("preserves headings as context but not targets", () => {
    const windows = detectCandidateWindows(fixtureIndex());
    const paymentWindow = windows.find((window) => window.targetGlobalLines.includes(4));

    expect(paymentWindow?.sourceLines.map((line) => line.globalLineNumber)).toContain(3);
    expect(paymentWindow?.targetGlobalLines).not.toContain(3);
    expect(renderCandidateWindowForLlm(paymentWindow!).split("\n")[0]).toBe(
      "  G3 P1:L3 Section 2. Payment",
    );
  });

  it("does not change source numbers when rendering a window for an LLM", () => {
    const paymentWindow = detectCandidateWindows(fixtureIndex()).find((window) =>
      window.targetGlobalLines.includes(4),
    );

    expect(renderCandidateWindowForLlm(paymentWindow!)).toContain(
      "* G4 P1:L4 Customer shall pay all invoices for the Services.",
    );
  });

  it("keeps repeated execution stable for window IDs", () => {
    const index = fixtureIndex();
    const firstIds = detectCandidateWindows(index).map((window) => window.id);
    const secondIds = detectCandidateWindows(index).map((window) => window.id);

    expect(secondIds).toEqual(firstIds);
  });

  it("preserves exposed section paths and merges close windows inside the same section", () => {
    const index = new ContractSourceIndex([
      {
        globalLineNumber: 1,
        pageNumber: 1,
        pageLocalLineNumber: 1,
        text: "Vendor shall deliver the implementation plan.",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Services"],
      },
      {
        globalLineNumber: 2,
        pageNumber: 1,
        pageLocalLineNumber: 2,
        text: "The parties acknowledge the project schedule.",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Services"],
      },
      {
        globalLineNumber: 3,
        pageNumber: 1,
        pageLocalLineNumber: 3,
        text: "Vendor must maintain the support desk.",
        sourceMethod: "PDF_TEXT",
        sectionPath: ["Services"],
      },
    ]);

    const windows = detectCandidateWindows(index, {
      precedingContextLineCount: 0,
      followingContextLineCount: 0,
      maxWindowLineCount: 5,
      maxWindowCharacters: 2_000,
      mergeGapLineCount: 1,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0]?.sectionPath).toEqual(["Services"]);
    expect(windows[0]?.targetGlobalLines).toEqual([1, 3]);
  });

  it("bounds context by maximum window line count", () => {
    const windows = detectCandidateWindows(fixtureIndex(), {
      precedingContextLineCount: 4,
      followingContextLineCount: 4,
      maxWindowLineCount: 3,
      maxWindowCharacters: 2_000,
      mergeGapLineCount: 0,
    });

    expect(windows.every((window) => window.sourceLines.length <= 3)).toBe(true);
  });
});
