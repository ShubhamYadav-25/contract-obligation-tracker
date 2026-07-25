/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requireAuthContext } from "../../src/modules/auth/request-context.js";
import { MessageController } from "../../src/modules/messages/messages.controller.js";
import type { MessageReadRepository } from "../../src/modules/messages/messages.repository.js";
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

/**
 * @description Executes the create test app operation used by the application workflow.
 * @param {{ readonly obligations: ObligationRepository; readonly reminders: ReminderReadRepository; readonly messages?: MessageReadRepository; }} input - Input value for input.
 * @returns {unknown} Result of the create test app operation.
 */
function createTestApp(input: {
  readonly obligations: ObligationRepository;
  readonly reminders: ReminderReadRepository;
  readonly messages?: MessageReadRepository;
}) {
  const app = express();
  const obligationController = new ObligationController(undefined, input.obligations);
  const reminderController = new ReminderController(input.reminders);
  const messageController = new MessageController(
    input.messages ??
      ({ listByOrganization: vi.fn(async () => []) } as unknown as MessageReadRepository),
  );

  app.use(requestCorrelationMiddleware);
  app.use(express.json());
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
  app.get(
    "/api/messages",
    requireAuthContext,
    asyncRoute((request, response) => messageController.list(request, response)),
  );
  app.patch(
    "/api/obligations/:obligationId",
    requireAuthContext,
    asyncRoute((request, response) => obligationController.update(request, response)),
  );
  app.use(errorMiddleware);
  return app;
}

describe("read API routes", () => {
  it("lists obligations for the authenticated organization", async () => {
    const obligations = {
      listByOrganization: vi.fn(async () => ({
        items: [
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
            responsibleParty: "Network",
            counterparty: "Affiliate",
            category: "PAYMENT",
            timingType: "RECURRING",
            frequency: "Quarterly",
            triggerEvent: "end of calendar quarter",
            offsetValue: 45,
            offsetUnit: "days",
            offsetDirection: "after",
            confidence: 0.95,
            reviewStatus: "CONFIRMED",
            sourceAnchors: [
              {
                documentId: "00000000-0000-4000-8000-000000000005",
                pageNumber: 22,
                startLine: 600,
                endLine: 601,
                globalStartLine: 600,
                globalEndLine: 601,
                quotedText: "Network shall pay to Affiliate the Affiliate Advertising Share.",
                source: "reference_aware_obligation",
                evidenceRole: "ACTION",
                boxes: [],
              },
            ],
            version: 0,
          },
        ],
        total: 1,
        statusCounts: {
          UPCOMING: 1,
          DUE: 2,
          MET: 3,
          MISSED: 4,
        },
      })),
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
    expect(response.body.data.items[0]).toMatchObject({
      id: obligationId,
      contractId,
      contractDisplayName: "Vendor Agreement",
      title: "Monthly payment",
      reminderStatus: "PENDING",
      responsibleParty: "Network",
      counterparty: "Affiliate",
      category: "PAYMENT",
      frequency: "Quarterly",
      triggerEvent: "end of calendar quarter",
      confidence: 0.95,
      reviewStatus: "CONFIRMED",
      sourceAnchors: [
        expect.objectContaining({
          documentId: "00000000-0000-4000-8000-000000000005",
          pageNumber: 22,
          startLine: 600,
          endLine: 601,
          source: "reference_aware_obligation",
          evidenceRole: "ACTION",
        }),
      ],
    });
    expect(response.body.data).toMatchObject({
      total: 1,
      statusCounts: {
        UPCOMING: 1,
        DUE: 2,
        MET: 3,
        MISSED: 4,
      },
    });
    expect(obligations.listByOrganization).toHaveBeenCalledWith({
      organizationId,
      contractId,
      limit: 50,
      offset: 0,
    });
  });

  it("passes status and workflow filters through obligation listing", async () => {
    const obligations = {
      listByOrganization: vi.fn(async () => ({
        items: [],
        total: 0,
        statusCounts: {
          UPCOMING: 1,
          DUE: 0,
          MET: 0,
          MISSED: 0,
        },
      })),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ObligationRepository;
    const reminders = { listByOrganization: vi.fn() } as unknown as ReminderReadRepository;

    const response = await request(createTestApp({ obligations, reminders }))
      .get("/api/obligations?status=DUE&reminderStatus=PENDING&dueDateRange=NEXT_7_DAYS")
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
    expect(obligations.listByOrganization).toHaveBeenCalledWith({
      organizationId,
      status: "DUE",
      reminderStatus: "PENDING",
      dueDateRange: "NEXT_7_DAYS",
      limit: 50,
      offset: 0,
    });
  });

  it("updates editable obligation fields for the authenticated organization", async () => {
    const obligations = {
      listByOrganization: vi.fn(),
      findById: vi.fn(),
      findDetailByOrganizationAndId: vi.fn(),
      updateStatus: vi.fn(),
      updateEditableFields: vi.fn(async () => ({
        id: obligationId,
        contractId,
        contractDisplayName: "Vendor Agreement",
        title: "Updated monthly payment",
        description: "Pay updated monthly fees.",
        status: "UPCOMING",
        dueAt: new Date("2026-08-15T00:00:00.000Z"),
        responsibleParty: "Network",
        counterparty: "Affiliate",
        category: "PAYMENT",
        timingType: "FIXED_DATE",
        frequency: "Monthly",
        triggerEvent: "invoice receipt",
        offsetValue: 10,
        offsetUnit: "days",
        offsetDirection: "after",
        reviewStatus: "CONFIRMED",
        sourceAnchors: [],
        version: 4,
      })),
    } as unknown as ObligationRepository;
    const reminders = { listByOrganization: vi.fn() } as unknown as ReminderReadRepository;

    const response = await request(createTestApp({ obligations, reminders }))
      .patch(`/api/obligations/${obligationId}`)
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .send({
        expectedVersion: 3,
        title: "Updated monthly payment",
        description: "Pay updated monthly fees.",
        dueAt: "2026-08-15T00:00:00.000Z",
        responsibleParty: "Network",
        counterparty: "Affiliate",
        category: "PAYMENT",
        timingType: "FIXED_DATE",
        frequency: "Monthly",
        triggerEvent: "invoice receipt",
        offsetValue: 10,
        offsetUnit: "days",
        offsetDirection: "after",
        reviewStatus: "CONFIRMED",
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: obligationId,
      title: "Updated monthly payment",
      responsibleParty: "Network",
      version: 4,
    });
    expect(obligations.updateEditableFields).toHaveBeenCalledWith({
      organizationId,
      obligationId,
      expectedVersion: 3,
      fields: {
        title: "Updated monthly payment",
        description: "Pay updated monthly fees.",
        dueAt: new Date("2026-08-15T00:00:00.000Z"),
        responsibleParty: "Network",
        counterparty: "Affiliate",
        category: "PAYMENT",
        timingType: "FIXED_DATE",
        frequency: "Monthly",
        triggerEvent: "invoice receipt",
        offsetValue: 10,
        offsetUnit: "days",
        offsetDirection: "after",
        reviewStatus: "CONFIRMED",
      },
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

  it("lists inbox messages for delivered reminders", async () => {
    const obligations = { listByOrganization: vi.fn() } as unknown as ObligationRepository;
    const reminders = { listByOrganization: vi.fn() } as unknown as ReminderReadRepository;
    const messages = {
      listByOrganization: vi.fn(async () => [
        {
          id: "00000000-0000-4000-8000-000000000006",
          reminderId: "00000000-0000-4000-8000-000000000005",
          obligationId,
          contractId,
          contractDisplayName: "Vendor Agreement",
          obligationTitle: "Monthly payment",
          reminderStatus: "DELIVERED",
          scheduledFor: new Date("2026-07-30T00:00:00.000Z"),
          payload: {
            type: "OBLIGATION_REMINDER",
            obligationTitle: "Monthly payment",
          },
          createdAt: new Date("2026-07-30T01:00:00.000Z"),
        },
      ]),
    } as unknown as MessageReadRepository;

    const response = await request(createTestApp({ obligations, reminders, messages }))
      .get(`/api/messages?obligationId=${obligationId}`)
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      obligationId,
      contractId,
      contractDisplayName: "Vendor Agreement",
      obligationTitle: "Monthly payment",
      reminderStatus: "DELIVERED",
      payload: {
        type: "OBLIGATION_REMINDER",
      },
    });
    expect(messages.listByOrganization).toHaveBeenCalledWith({
      organizationId,
      obligationId,
      limit: 50,
      offset: 0,
    });
  });
});
