import path from "node:path";

const unsafeFilenameCharacters = /[^a-zA-Z0-9._-]/g;

export function sanitizeFilename(filename: string): string {
  const parsed = path.parse(filename);
  const base = parsed.name
    .replace(unsafeFilenameCharacters, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  const extension = parsed.ext.toLowerCase().replace(unsafeFilenameCharacters, "");
  return `${base || "contract"}${extension}`;
}

export function createSupabaseObjectKey(input: {
  readonly sha256: string;
  readonly originalFilename: string;
  readonly contractId?: string;
}): string {
  const filename = sanitizeFilename(input.originalFilename);
  const prefix = input.contractId
    ? `contracts/${input.contractId}`
    : `contracts/${input.sha256.slice(0, 12)}`;
  return `${prefix}/${input.sha256}/${filename}`;
}
