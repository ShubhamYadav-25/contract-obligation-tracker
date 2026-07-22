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
