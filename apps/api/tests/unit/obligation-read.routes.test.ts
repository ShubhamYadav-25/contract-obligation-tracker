import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requireAuthContext } from "../../src/modules/auth/request-context.js";
import { ObligationController } from "../../src/modules/obligations/obligations.controller.js";
import type { ObligationRepository } from "../../src/modules/obligations/obligations.repository.js";
import { ReminderController } from "../../src/modules/reminders/reminders.controller.js";
import type { ReminderReadRepository } from "../../src/modules/reminders/reminders.repository.js";
import { asyncRoute } from "../../src/shared/middleware/async-route.js";
import { errorMiddleware } from "../../src/shared/middleware/error.middleware.js";
import { requestCorrelationMiddleware } from "../../src/shared/middleware/request-correlation.middleware.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const contractId = "00000000-0000-4000-8000-000000000003";
const obligationId = "00000000-0000-4000-8000-000000000004";

function createTestApp(input: {
  readonly obligations: ObligationRepository;
  readonly reminders: ReminderReadRepository;
}) {
  const app = express();
  const obligationController = new ObligationController(undefined, input.obligations);
  const reminderController = new ReminderController(input.reminders);

  app.use(requestCorrelationMiddleware);
  app.get(
    "/api/obligations",
    requireAuthContext,
    asyncRoute((request, response) => obligationController.list(request, response)),
  );
  app.get(
    "/api/reminders",
    requireAuthContext,
    asyncRoute((request, response) => reminderController.list(request, response)),
  );
  app.use(errorMiddleware);
  return app;
}

describe("read API routes", () => {
  it("lists obligations for the authenticated organization", async () => {
    const obligations = {
      listByOrganization: vi.fn(async () => [
        {
          id: obligationId,
          contractId,
          contractDisplayName: "Vendor Agreement",
          title: "Monthly payment",
          description: "Pay monthly fees.",
          status: "UPCOMING",
          dueAt: new Date("2026-08-01T00:00:00.000Z"),
          reminderStatus: "PENDING",
          nextReminderAt: new Date("2026-07-30T00:00:00.000Z"),
          version: 0,
        },
      ]),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ObligationRepository;
    const reminders = { listByOrganization: vi.fn() } as unknown as ReminderReadRepository;

    const response = await request(createTestApp({ obligations, reminders }))
      .get(`/api/obligations?contractId=${contractId}`)
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: obligationId,
      contractId,
      contractDisplayName: "Vendor Agreement",
      title: "Monthly payment",
      reminderStatus: "PENDING",
    });
    expect(obligations.listByOrganization).toHaveBeenCalledWith({
      organizationId,
      contractId,
      limit: 50,
      offset: 0,
    });
  });

  it("lists reminders for the authenticated organization", async () => {
    const obligations = { listByOrganization: vi.fn() } as unknown as ObligationRepository;
    const reminders = {
      listByOrganization: vi.fn(async () => [
        {
          id: "00000000-0000-4000-8000-000000000005",
          obligationId,
          contractId,
          obligationTitle: "Monthly payment",
          scheduledFor: new Date("2026-07-30T00:00:00.000Z"),
          occurrenceKey: "reminder-key",
          status: "PENDING",
          retryCount: 0,
          version: 0,
        },
      ]),
    } as unknown as ReminderReadRepository;

    const response = await request(createTestApp({ obligations, reminders }))
      .get(`/api/reminders?obligationId=${obligationId}`)
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      obligationId,
      contractId,
      obligationTitle: "Monthly payment",
      status: "PENDING",
    });
    expect(reminders.listByOrganization).toHaveBeenCalledWith({
      organizationId,
      obligationId,
      limit: 50,
      offset: 0,
    });
  });
});
