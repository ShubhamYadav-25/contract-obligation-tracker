import { describe, it, expect } from "vitest";
import { ObligationService } from "../../src/modules/obligations/obligations.service.js";
import { NotFoundError } from "../../src/shared/errors/not-found-error.js";
import { InvalidTransitionError } from "../../src/shared/errors/invalid-transition-error.js";

const now = new Date("2026-07-22T00:00:00.000Z");

class FakeClock {
  now() {
    return now;
  }
}

function makeFakeRepo(initialStatus = "UPCOMING", version = 0) {
  let record = {
    id: "ob-1",
    contractId: "c-1",
    title: "Obligation 1",
    description: "",
    status: initialStatus,
    dueAt: undefined,
    version,
  };

  return {
    async findById(id: string) {
      return id === record.id ? { ...record } : null;
    },
    async updateStatus(input: { id: string; fromStatus: string; toStatus: string; expectedVersion: number }) {
      if (input.id !== record.id) throw new NotFoundError("Obligation not found", { obligationId: input.id });
      if (record.status !== input.fromStatus) throw new Error("Status mismatch");
      if (record.version !== input.expectedVersion) throw new Error("Version mismatch");
      record = { ...record, status: input.toStatus, version: record.version + 1 };
      return { ...record };
    },
  };
}

function makeTransitionHistory() {
  const events: any[] = [];
  return {
    async record(input: any) {
      events.push(input);
    },
    events,
  };
}

describe("ObligationService transition", () => {
  it("rejects illegal transitions via state machine before repository call", async () => {
    const obligations = makeFakeRepo("MET", 1);
    const transitionHistory = makeTransitionHistory();
    const svc = new ObligationService(obligations as any, transitionHistory as any, new FakeClock() as any);

    await expect(
      svc.transition({ obligationId: "ob-1", fromStatus: "MET", toStatus: "DUE", expectedVersion: 1, actorId: "user-1" }),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("performs valid transition and records history", async () => {
    const obligations = makeFakeRepo("UPCOMING", 0);
    const transitionHistory = makeTransitionHistory();
    const svc = new ObligationService(obligations as any, transitionHistory as any, new FakeClock() as any);

    const updated = await svc.transition({ obligationId: "ob-1", fromStatus: "UPCOMING", toStatus: "DUE", expectedVersion: 0, actorId: "user-1" });
    expect(updated.status).toBe("DUE");
    expect(updated.version).toBe(1);
    expect(transitionHistory.events).toHaveLength(1);
    expect(transitionHistory.events[0].fromStatus).toBe("UPCOMING");
  });

  it("throws NotFoundError if obligation not found", async () => {
    const obligations = makeFakeRepo("UPCOMING", 0);
    const transitionHistory = makeTransitionHistory();
    const svc = new ObligationService(obligations as any, transitionHistory as any, new FakeClock() as any);

    await expect(
      svc.transition({ obligationId: "missing", fromStatus: "UPCOMING", toStatus: "DUE", expectedVersion: 0, actorId: "user-1" }),
    ).rejects.toThrow(NotFoundError);
  });
});
