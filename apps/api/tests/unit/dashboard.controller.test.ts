import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { DashboardController } from "../../src/modules/dashboard/dashboard.controller.js";

function responseMock() {
  const json = vi.fn();
  return {
    json,
    locals: { correlationId: "request-1" },
  } as unknown as Response;
}

function requestMock(query: Record<string, unknown> = {}) {
  return {
    authContext: {
      userId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
    },
    query,
  } as unknown as Request;
}

describe("DashboardController", () => {
  it("returns database-derived overview data unchanged", async () => {
    const data = {
      kpis: { totalContracts: 4, awaitingReview: 2 },
      attentionRequired: [{ id: "failure-1" }],
      upcomingDeadlines: [{ id: "obligation-1" }],
    };
    const operations = {
      overview: vi.fn().mockResolvedValue(data),
      reviewQueue: vi.fn(),
    };
    const response = responseMock();

    await new DashboardController(operations as any).overview(requestMock(), response);

    expect(operations.overview).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data }),
    );
  });

  it("paginates the real review queue", async () => {
    const data = { total: 1, items: [{ id: "candidate-1" }] };
    const operations = {
      overview: vi.fn(),
      reviewQueue: vi.fn().mockResolvedValue(data),
    };
    const response = responseMock();

    await new DashboardController(operations as any).reviewQueue(
      requestMock({ limit: "10", offset: "20" }),
      response,
    );

    expect(operations.reviewQueue).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      10,
      20,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data }),
    );
  });
});
