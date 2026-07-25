/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "./review-form.js";

describe("ReviewForm", () => {
  it("validates required editable fields before approval", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();

    render(
      <ReviewForm
        defaultValues={{ description: "Existing", title: "" }}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();
  });
});
