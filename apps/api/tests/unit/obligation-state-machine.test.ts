import { describe, expect, it } from "vitest";

import {
  assertObligationTransition,
  canTransitionObligation,
  getAllowedObligationTransitions,
} from "../../src/modules/obligations/obligation.state-machine.js";
import { InvalidTransitionError } from "../../src/shared/errors/invalid-transition-error.js";

describe("obligation state machine", () => {
  it("allows only canonical obligation transitions", () => {
    expect(canTransitionObligation("UPCOMING", "DUE")).toBe(true);
    expect(canTransitionObligation("DUE", "MET")).toBe(true);
    expect(canTransitionObligation("DUE", "MISSED")).toBe(true);
  });

  it("rejects non-canonical transitions", () => {
    expect(canTransitionObligation("UPCOMING", "MET")).toBe(false);
    expect(canTransitionObligation("MET", "DUE")).toBe(false);
    expect(() => assertObligationTransition("MISSED", "MET")).toThrow(InvalidTransitionError);
  });

  it("keeps terminal states terminal", () => {
    expect(getAllowedObligationTransitions("MET")).toEqual([]);
    expect(getAllowedObligationTransitions("MISSED")).toEqual([]);
  });
});
