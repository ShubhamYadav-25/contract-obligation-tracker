import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { canTransitionObligation } from "../../src/modules/obligations/obligation.state-machine.js";
import { createReminderOccurrenceKey } from "../../src/modules/reminders/reminder-occurrence-key.js";

function readJsonl(relativePath: string): Array<Record<string, unknown>> {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("Trial datasets", () => {
  it("loads the committed contract fixture set and validates required fields", () => {
    const contracts = readJsonl("../../datasets/contracts/25_contracts.jsonl");
    expect(contracts).toHaveLength(25);

    for (const contract of contracts) {
      expect(contract.expected).toBeDefined();
      expect(contract.sampleText).toEqual(expect.any(String));
      expect(contract.generatedAt).toEqual(expect.any(String));

      const expected = contract.expected as Record<string, unknown>;
      expect(expected.parties).toEqual(expect.any(Array));
      expect(expected.contractValue).toEqual(expect.any(Number));
      expect(expected.termMonths).toEqual(expect.any(Number));
      expect(expected.renewalTerms).toEqual(expect.any(String));
      expect(expected.noticePeriodDays).toEqual(expect.any(Number));
      expect(expected.obligationCount).toEqual(expect.any(Number));
    }
  });

  it("loads the transition dataset and validates the obligation state machine", () => {
    const transitions = readJsonl("../../datasets/transitions/100_state_transitions.jsonl");
    expect(transitions).toHaveLength(100);

    for (const transition of transitions) {
      const from = transition.from as "UPCOMING" | "DUE" | "MET" | "MISSED";
      const to = transition.to as "UPCOMING" | "DUE" | "MET" | "MISSED";
      expect(canTransitionObligation(from, to)).toBe(transition.expectedAllowed);
    }
  });

  it("loads the reminder dataset and validates deterministic occurrence keys", () => {
    const reminders = readJsonl("../../datasets/reminders/20_restart_scenarios.jsonl");
    expect(reminders).toHaveLength(20);

    const occurrenceKeys = new Set<string>();
    for (const reminder of reminders) {
      const obligationId = reminder.obligationId as string;
      const scheduledFor = new Date(reminder.scheduledFor as string);
      const occurrenceKey = createReminderOccurrenceKey({ obligationId, scheduledFor });
      expect(occurrenceKey).toBe(reminder.expectedOccurrenceKey);
      occurrenceKeys.add(occurrenceKey);
    }

    expect(occurrenceKeys.size).toBe(20);
  });
});
