import { render } from "@testing-library/react";
import axe from "axe-core";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/app-shell.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import {
  DataTable,
  FilterBar,
  SearchInput,
  SectionCard,
  StatusBadge,
  TableHead,
} from "@/features/workflow/components.js";

function AccessibilityReviewPage() {
  return (
    <ContentContainer>
      <PageHeader
        actions={<Button type="button">Upload contract</Button>}
        description="Review and manage contract obligations."
        title="Contract operations"
      />
      <FilterBar>
        <SearchInput placeholder="Search contracts" />
        <Button type="button" variant="secondary">Clear filters</Button>
      </FilterBar>
      <SectionCard title="Active obligations">
        <DataTable>
          <TableHead columns={["Obligation", "Status", "Action"]} />
          <tbody>
            <tr>
              <th className="px-5 py-4 text-left" scope="row">Submit compliance report</th>
              <td className="px-5 py-4"><StatusBadge label="Due" tone="warning" /></td>
              <td className="px-5 py-4"><Button size="sm" type="button">Review</Button></td>
            </tr>
          </tbody>
        </DataTable>
      </SectionCard>
    </ContentContainer>
  );
}

describe("open-source accessibility review", () => {
  it("passes axe-core checks for the shared shell and common workflow controls", async () => {
    const router = createMemoryRouter(
      [{
        element: <AppShell />,
        children: [{ path: "/", element: <AccessibilityReviewPage /> }],
      }],
      { initialEntries: ["/"] },
    );
    const { container } = render(<RouterProvider router={router} />);
    const result = await axe.run(container);

    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
      })),
    ).toEqual([]);
  });
});
