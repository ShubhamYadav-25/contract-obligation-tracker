import { describe, expect, it } from "vitest";

import { uploadContractSchema } from "./upload-contract.schema.js";

describe("uploadContractSchema", () => {
  it("accepts non-empty PDF files", () => {
    const file = new File(["%PDF-"], "contract.pdf", { type: "application/pdf" });

    expect(uploadContractSchema.safeParse({ file }).success).toBe(true);
  });

  it("rejects non-PDF files", () => {
    const file = new File(["hello"], "contract.txt", { type: "text/plain" });

    expect(uploadContractSchema.safeParse({ file }).success).toBe(false);
  });
});
