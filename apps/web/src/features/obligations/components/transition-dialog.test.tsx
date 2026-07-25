/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransitionDialog } from "./transition-dialog.js";

describe("TransitionDialog", () => {
  it("shows only valid transitions for upcoming obligations", () => {
    render(<TransitionDialog onSelect={vi.fn()} status="UPCOMING" />);

    expect(screen.getByRole("button", { name: /mark due/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark met/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark missed/i })).not.toBeInTheDocument();
  });

  it("shows no controls for terminal statuses", () => {
    render(<TransitionDialog onSelect={vi.fn()} status="MET" />);

    expect(screen.getByText(/no transitions are available/i)).toBeInTheDocument();
  });
});
