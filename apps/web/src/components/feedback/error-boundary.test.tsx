/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./error-boundary.js";

/**
 * @description Renders the throwing component component for the contract tracker UI.
 * @returns {ReactElement} Result of the throwing component operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function ThrowingComponent(): ReactElement {
  throw new Error("Boundary check");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders recoverable error UI for render failures", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Boundary check");
  });
});
