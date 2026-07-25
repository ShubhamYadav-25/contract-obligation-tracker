/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiScoreboard } from "./kpi-scoreboard.js";

describe("KpiScoreboard", () => {
  it("renders status text and evidence columns without hard-coded results", () => {
    render(
      <KpiScoreboard
        metrics={[
          {
            kpi: "source anchoring",
            target: ">= 95%",
            status: "NOT_MEASURED",
            measurementMethod: "validated dataset",
          },
        ]}
      />,
    );

    expect(screen.getByText("source anchoring")).toBeInTheDocument();
    expect(screen.getByText("NOT MEASURED")).toBeInTheDocument();
    expect(screen.getAllByText("Not measured").length).toBeGreaterThan(0);
    expect(screen.getByText("validated dataset")).toBeInTheDocument();
  });
});
