/**
 * @file Contains unit tests for reminder email templates and delivery semantics.
 */
import { describe, expect, it, vi } from "vitest";

import { ReminderDeliveryProcessor } from "../../src/jobs/processors/reminder-delivery.processor.js";
import type { BackgroundJob } from "../../src/jobs/job.types.js";
import type { TransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import type { NotificationProvider } from "../../src/modules/notifications/notifications.types.js";
import {
  buildReminderEmail,
  calculateDaysRemaining,
  createReminderTimingLabel,
} from "../../src/modules/reminders/reminder-email-template.js";

/**
 * @description Creates a valid reminder delivery background job for processor tests.
 * @param {{ readonly reminderId: string; readonly occurrenceKey: string }} payload - Reminder delivery identifiers.
 * @returns {BackgroundJob} Background job fixture.
 */
function createJob(payload: {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}): BackgroundJob {
  return {
    id: "job-1",
    jobType: "DELIVER_REMINDER",
    idempotencyKey: `reminder:${payload.reminderId}`,
    payload,
    status: "PENDING",
    priority: 0,
    availableAt: new Date("2026-07-24T00:00:00.000Z"),
    attemptCount: 0,
    maxAttempts: 3,
    createdAt: new Date("2026-07-24T00:00:00.000Z"),
    updatedAt: new Date("2026-07-24T00:00:00.000Z"),
  };
}

describe("reminder email template", () => {
  it("creates clear timing labels from days remaining", () => {
    expect(createReminderTimingLabel(undefined)).toBe("Timing-based reminder");
    expect(createReminderTimingLabel(-2)).toBe("Overdue by 2 days");
    expect(createReminderTimingLabel(0)).toBe("Due today");
    expect(createReminderTimingLabel(1)).toBe("Due tomorrow");
    expect(createReminderTimingLabel(7)).toBe("Due in 7 days");
  });

  it("builds a styled email with due-date timing metadata", () => {
    const email = buildReminderEmail({
      appName: "Contract Obligation Tracker",
      contractName: "Affiliate Agreement",
      obligationTitle: "Send renewal notice",
      obligationDescription: "Notify the network before renewal.",
      responsibleParty: "Affiliate",
      category: "NOTICE",
      dueAt: new Date("2026-07-31T00:00:00.000Z"),
      scheduledFor: new Date("2026-07-24T00:00:00.000Z"),
      now: new Date("2026-07-24T00:00:00.000Z"),
      contractUrl: "http://localhost:5173/contracts/contract-1",
    });

    expect(calculateDaysRemaining(new Date("2026-07-31T00:00:00.000Z"), emailTime())).toBe(7);
    expect(email.daysRemaining).toBe(7);
    expect(email.subject).toContain("Due in 7 days");
    expect(email.bodyHtml).toContain("#00A878");
    expect(email.bodyText).toContain("Open contract: http://localhost:5173/contracts/contract-1");
  });
});

describe("ReminderDeliveryProcessor", () => {
  it("does not create a message entry when email delivery is rejected", async () => {
    const reminderId = "11111111-1111-1111-1111-111111111111";
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM reminders AS reminder")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: reminderId,
              obligation_id: "22222222-2222-2222-2222-222222222222",
              status: "PENDING",
              retry_count: 0,
              scheduled_for: new Date("2026-07-24T00:00:00.000Z"),
              occurrence_key: "occurrence:alpha",
              contract_id: "33333333-3333-3333-3333-333333333333",
              contract_display_name: "Affiliate Agreement",
              obligation_title: "Send renewal notice",
              obligation_description: "Notify the network before renewal.",
              due_at: new Date("2026-07-31T00:00:00.000Z"),
              anchors: [{ obligatedParty: "Affiliate", obligationType: "NOTICE" }],
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const transactions: TransactionManager = {
      inTransaction: async (work) => work({ client: { query } as any }),
    };
    const notifications: NotificationProvider = {
      send: vi.fn(async () => ({ status: "rejected" as const })),
    };
    const processor = new ReminderDeliveryProcessor({} as any, transactions, notifications, {
      providerName: "TEST",
      appName: "Contract Obligation Tracker",
      appBaseUrl: "http://localhost:5173",
      defaultRecipient: "reviewer@example.com",
      now: () => new Date("2026-07-24T00:00:00.000Z"),
    });

    await expect(
      processor.process(createJob({ reminderId, occurrenceKey: "occurrence:alpha" })),
    ).rejects.toThrow("Reminder email delivery was rejected");

    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO inbox_entries"))).toBe(
      false,
    );
    expect(query.mock.calls.some(([sql]) => String(sql).includes("status = 'FAILED'"))).toBe(true);
  });
});

/**
 * @description Returns the fixed baseline time used by template tests.
 * @returns {Date} Fixed test timestamp.
 */
function emailTime(): Date {
  return new Date("2026-07-24T00:00:00.000Z");
}
