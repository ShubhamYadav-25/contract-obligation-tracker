/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage, ObligationsPage } from "./pages.js";
import type { ObligationListResult } from "../obligations/types/obligation.js";

const useObligationsMock = vi.fn();
const useContractsMock = vi.fn();
const useUploadContractMock = vi.fn();
const uploadMutateMock = vi.fn();
const uploadResetMock = vi.fn();
const reprocessMutateMock = vi.fn();
const useDashboardOverviewMock = vi.fn();

let uploadPending = false;

vi.mock("../obligations/hooks/use-obligations.js", () => ({
  useObligations: (...args: unknown[]) => useObligationsMock(...args),
}));

vi.mock("../contracts/hooks/use-contracts.js", () => ({
  useContracts: () => useContractsMock(),
}));

vi.mock("../contracts/hooks/use-reprocess-contract.js", () => ({
  useReprocessContract: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: reprocessMutateMock,
  }),
}));

vi.mock("./hooks/use-operations.js", () => ({
  useDashboardOverview: () => useDashboardOverviewMock(),
  useContractActivity: vi.fn(),
  useContractProfile: vi.fn(),
  useProcessingHistory: vi.fn(),
}));

vi.mock("../contract-upload/hooks/use-upload-contract.js", () => ({
  useUploadContract: () => useUploadContractMock(),
}));

vi.mock("@/components/features/pdf-reader/pdf-viewer-container.js", () => ({
  PdfViewerContainer: () => <div data-testid="pdf-viewer" />,
}));

const obligationData: ObligationListResult = {
  items: [
    {
      id: "obligation-met",
      contractId: "contract-a",
      contractDisplayName: "Master Services Agreement",
      title: "Security audit",
      status: "MET",
      dueAt: "2026-07-20T00:00:00.000Z",
      reminderStatus: "PENDING",
      sourceAnchors: [{ pageNumber: 3, boxes: [] }],
      version: 1,
    },
    {
      id: "obligation-due",
      contractId: "contract-b",
      contractDisplayName: "Renewal Addendum",
      title: "Payment review",
      status: "DUE",
      dueAt: "2026-07-28T00:00:00.000Z",
      reminderStatus: "PENDING",
      sourceAnchors: [{ pageNumber: 1, boxes: [] }],
      version: 1,
    },
  ],
  statusCounts: {
    UPCOMING: 10,
    DUE: 3,
    MET: 1,
    MISSED: 1,
  },
  total: 15,
};

/**
 * @description Performs the render obligations page helper operation for this module.
 * @returns {unknown} Result of the render obligations page operation.
 */
function renderObligationsPage() {
  return render(
    <MemoryRouter>
      <ObligationsPage />
    </MemoryRouter>,
  );
}

/**
 * @description Performs the render dashboard page helper operation for this module.
 * @returns {unknown} Result of the render dashboard page operation.
 */
function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("ObligationsPage", () => {
  beforeEach(() => {
    useObligationsMock.mockImplementation((_contractId, input) => ({
      data: {
        ...obligationData,
        items: input?.status
          ? obligationData.items.filter((item) => item.status === input.status)
          : obligationData.items,
      },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      isSuccess: true,
    }));
    useContractsMock.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    });
    useDashboardOverviewMock.mockReturnValue({
      data: {
        kpis: {
          totalContracts: 0,
          uploadedThisMonth: 0,
          processing: 0,
          awaitingReview: 0,
          lowConfidenceItems: 0,
          extracting: 0,
          queued: 0,
          dueSoon: 0,
          missed: 0,
          permanentAuditActionNeeded: 0,
        },
        attentionRequired: [],
        upcomingDeadlines: [],
      },
      error: null,
      isError: false,
      isLoading: false,
    });
    uploadPending = false;
    useUploadContractMock.mockImplementation(() => ({
      error: null,
      isPending: uploadPending,
      mutate: uploadMutateMock,
      reset: uploadResetMock,
    }));
  });

  afterEach(() => {
    uploadMutateMock.mockReset();
    uploadResetMock.mockReset();
    reprocessMutateMock.mockReset();
    useDashboardOverviewMock.mockReset();
    useContractsMock.mockReset();
    useUploadContractMock.mockReset();
    vi.restoreAllMocks();
  });

  it("renders universal counts, contract names, filters, and routed action links", async () => {
    const user = userEvent.setup();

    renderObligationsPage();

    expect(within(screen.getByRole("button", { name: /Upcoming/i })).getByText("10")).toBeVisible();
    expect(within(screen.getByRole("button", { name: /Due/i })).getByText("3")).toBeVisible();
    expect(within(screen.getByRole("button", { name: /Met/i })).getByText("1")).toBeVisible();
    expect(within(screen.getByRole("button", { name: /Missed/i })).getByText("1")).toBeVisible();

    expect(screen.getAllByText("Master Services Agreement").length).toBeGreaterThan(0);
    expect(screen.queryByText("contract-a")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Status filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Reminder filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Date range")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print/i })).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /Source/i })[0]).toHaveAttribute(
      "href",
      "/contracts/contract-a",
    );
    expect(screen.getAllByRole("link", { name: /Details/i })[0]).toHaveAttribute(
      "href",
      "/obligations/obligation-met",
    );

    await user.click(screen.getByRole("button", { name: /Due/i }));

    await waitFor(() => {
      expect(useObligationsMock).toHaveBeenLastCalledWith(
        undefined,
        expect.objectContaining({ status: "DUE" }),
      );
    });
    expect(screen.getByText("Filtered by Due")).toBeVisible();
  });

  it("shows responsive upload processing feedback in the dashboard modal", async () => {
    const user = userEvent.setup();
    const { rerender } = renderDashboardPage();

    await user.click(screen.getByRole("button", { name: "Upload Contract" }));

    const dialog = screen.getByRole("dialog");
    const file = new File(["%PDF-"], "vendor-contract.pdf", { type: "application/pdf" });
    await user.upload(within(dialog).getByLabelText("Browse Files"), file);
    await user.click(within(dialog).getByRole("button", { name: "Upload Contract" }));

    expect(uploadMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ file }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    uploadPending = true;
    rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("File received by the upload flow")).toBeVisible();
    expect(screen.getByText("Uploading PDF")).toBeVisible();
    expect(screen.getByRole("button", { name: /Uploading/i })).toBeDisabled();
  });
});
