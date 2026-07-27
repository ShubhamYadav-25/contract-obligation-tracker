import { describe, expect, it } from "vitest";

import {
  contractProfileFieldsSchema,
  updateContractProfileSchema,
} from "../../src/modules/contract-profiles/contract-profile.schemas.js";

describe("contract profile schemas", () => {
  it("normalizes and accepts a complete workspace profile", () => {
    const result = contractProfileFieldsSchema.parse({
      parties: ["Customer", "Supplier"],
      contractValue: "420000.00",
      currency: "usd",
      effectiveDate: "2026-02-01",
      expirationDate: "2026-12-31",
      renewalType: "Auto-renewal",
      noticePeriodDays: 60,
      nextObligationSummary: "Send renewal notice",
      extractionConfidence: 0.72,
    });

    expect(result.currency).toBe("USD");
    expect(result.parties).toEqual(["Customer", "Supplier"]);
  });

  it("rejects an expiration date before the effective date", () => {
    expect(() =>
      contractProfileFieldsSchema.parse({
        effectiveDate: "2026-12-31",
        expirationDate: "2026-02-01",
      }),
    ).toThrow(/Expiration date/);
  });

  it("requires at least one field for a patch", () => {
    expect(() => updateContractProfileSchema.parse({})).toThrow(
      /At least one profile field/,
    );
    expect(updateContractProfileSchema.parse({ noticePeriodDays: null })).toEqual({
      noticePeriodDays: null,
    });
  });
});
