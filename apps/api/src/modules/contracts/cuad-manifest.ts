import { relative, resolve, sep } from "node:path";

import { z } from "zod";

export const cuadManifestEntrySchema = z.object({
  datasetId: z.string().regex(/^contract-\d{3}$/),
  source: z.literal("CUAD_V1").default("CUAD_V1"),
  originalDocumentName: z.string().min(1),
  filename: z.string().min(1).endsWith(".pdf"),
  relativePath: z.string().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  hasRenewalTerm: z.boolean(),
  hasRenewalNotice: z.boolean(),
  selectionPriority: z.number().int().positive(),
});

export type CuadManifestEntry = z.infer<typeof cuadManifestEntrySchema> & {
  readonly relativePath: string;
};

export interface CuadManifest {
  readonly contracts: readonly CuadManifestEntry[];
}

const manifestSchema = z.object({
  contractCount: z.number().int().positive().optional(),
  contracts: z.array(cuadManifestEntrySchema).length(25),
});

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  if (duplicates.size > 0) {
    throw new Error(`CUAD manifest contains duplicate ${label}: ${[...duplicates].join(", ")}`);
  }
}

export function parseCuadManifest(input: unknown): CuadManifest {
  const parsed = manifestSchema.parse(input);
  const contractCount = parsed.contractCount ?? parsed.contracts.length;
  if (contractCount !== 25 || contractCount !== parsed.contracts.length) {
    throw new Error("CUAD manifest contract count does not match the 25-contract subset");
  }

  const contracts = parsed.contracts.map((entry) => ({
    ...entry,
    relativePath: entry.relativePath ?? `contracts/${entry.filename}`,
  }));

  assertUnique(
    contracts.map((entry) => entry.datasetId),
    "datasetId values",
  );
  assertUnique(
    contracts.map((entry) => entry.filename),
    "filenames",
  );
  assertUnique(
    contracts.map((entry) => entry.relativePath),
    "relative paths",
  );
  assertUnique(
    contracts.map((entry) => entry.sha256),
    "SHA-256 hashes",
  );

  return { contracts };
}

export function resolveWorkingSubsetPath(input: {
  readonly workingSubsetRoot: string;
  readonly relativePath: string;
}): string {
  if (resolve(input.relativePath) === input.relativePath) {
    throw new Error("CUAD manifest path must be relative");
  }

  const resolvedRoot = resolve(input.workingSubsetRoot);
  const resolvedFile = resolve(resolvedRoot, input.relativePath);
  const relativePath = relative(resolvedRoot, resolvedFile);

  if (
    relativePath.startsWith("..") ||
    relativePath === ".." ||
    resolve(relativePath) === relativePath ||
    relativePath.split(sep).includes("..")
  ) {
    throw new Error("CUAD manifest path escapes working-subset");
  }

  return resolvedFile;
}
