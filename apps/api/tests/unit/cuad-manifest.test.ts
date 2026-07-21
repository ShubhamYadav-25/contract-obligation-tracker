import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseCuadManifest,
  resolveWorkingSubsetPath,
} from "../../src/modules/contracts/cuad-manifest.js";

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "../../working-subset/manifest.json"), "utf8"),
);

describe("CUAD manifest validation", () => {
  it("accepts the actual 25-contract working subset manifest", () => {
    const parsed = parseCuadManifest(manifest);

    expect(parsed.contracts).toHaveLength(25);
    expect(parsed.contracts[0]?.relativePath).toMatch(/^contracts\//);
  });

  it("rejects duplicate dataset IDs", () => {
    const duplicate = structuredClone(manifest);
    duplicate.contracts[1].datasetId = duplicate.contracts[0].datasetId;

    expect(() => parseCuadManifest(duplicate)).toThrow(/duplicate datasetId/);
  });

  it("rejects invalid SHA-256 values", () => {
    const invalid = structuredClone(manifest);
    invalid.contracts[0].sha256 = "not-a-hash";

    expect(() => parseCuadManifest(invalid)).toThrow();
  });

  it("rejects path traversal", () => {
    expect(() =>
      resolveWorkingSubsetPath({
        workingSubsetRoot: join(process.cwd(), "../../working-subset"),
        relativePath: "../outside.pdf",
      }),
    ).toThrow(/escapes/);
  });
});
