import { describe, expect, it } from "vitest";

import {
  isPdfSourceNavigationCommand,
  normalizeSourceBox,
  toHighlightRect,
} from "./pdf-source-navigation.js";

describe("pdf source navigation", () => {
  it("validates PDF_NAVIGATE_TO_SOURCE messages", () => {
    expect(
      isPdfSourceNavigationCommand({
        type: "PDF_NAVIGATE_TO_SOURCE",
        payload: {
          pageNumber: 24,
          startLine: 638,
          endLine: 639,
          quotedText: "The Affiliate Transactional Share shall be payable quarterly.",
          boxes: [{ x: 0.11, y: 0.47, width: 0.76, height: 0.024 }],
        },
      }),
    ).toBe(true);

    expect(
      isPdfSourceNavigationCommand({
        type: "PDF_NAVIGATE_TO_SOURCE",
        payload: { pageNumber: 0, boxes: [] },
      }),
    ).toBe(false);
  });

  it("keeps page navigation separate from page-local line numbers", () => {
    const command = {
      type: "PDF_NAVIGATE_TO_SOURCE",
      payload: {
        pageNumber: 23,
        startLine: 638,
        endLine: 639,
        quotedText: "The Affiliate Transactional Share shall be payable quarterly.",
        boxes: [{ x: 0.08, y: 0.12, width: 0.84, height: 0.026 }],
      },
    };

    expect(isPdfSourceNavigationCommand(command)).toBe(true);
    expect(command.payload.pageNumber).toBe(23);
    expect(command.payload.startLine).toBe(638);
  });

  it("converts normalized source boxes to overlay rectangles", () => {
    expect(
      normalizeSourceBox({
        x: 0.9,
        y: -1,
        width: 0.5,
        height: 2,
      }),
    ).toEqual({
      x: 0.9,
      y: 0,
      width: 0.09999999999999998,
      height: 1,
    });

    expect(
      toHighlightRect({
        x: 0.11,
        y: 0.47,
        width: 0.76,
        height: 0.024,
      }),
    ).toEqual({
      left: "11%",
      top: "47%",
      width: "76%",
      height: "2.4%",
    });
  });
});
