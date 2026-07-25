/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import {
  createSupabaseObjectKey,
  sanitizeFilename,
} from "../../src/infrastructure/storage/object-key.js";

describe("Supabase object keys", () => {
  it("sanitizes unsafe filenames", () => {
    expect(sanitizeFilename("Master Services Agreement (Final).PDF")).toBe(
      "Master-Services-Agreement-Final.pdf",
    );
  });

  it("uses stable private object key identity", () => {
    expect(
      createSupabaseObjectKey({
        contractId: "contract-1",
        sha256: "abcdef1234567890",
        originalFilename: "contract.pdf",
      }),
    ).toBe("contracts/contract-1/abcdef1234567890/contract.pdf");
  });
});
