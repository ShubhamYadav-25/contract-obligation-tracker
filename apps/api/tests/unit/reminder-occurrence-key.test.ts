import { describe, expect, it } from "vitest";

import { createReminderOccurrenceKey } from "../../src/modules/reminders/reminder-occurrence-key.js";

describe("reminder occurrence keys", () => {
  it("uses obligation id and scheduled timestamp deterministically", () => {
    const scheduledFor = new Date("2026-07-20T10:30:00.000Z");

    expect(
      createReminderOccurrenceKey({
        obligationId: "obl_123",
        scheduledFor,
      }),
    ).toBe("obligation:obl_123:scheduled:2026-07-20T10:30:00.000Z");
  });
});
