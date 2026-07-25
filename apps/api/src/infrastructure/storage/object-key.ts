/**
 * @file Defines object storage infrastructure contracts and adapters.
 */
import path from "node:path";

const unsafeFilenameCharacters = /[^a-zA-Z0-9._-]/g;

/**
 * @description Performs the sanitize filename helper operation for this module.
 * @param {string} filename - Input value for filename.
 * @returns {string} Result of the sanitize filename operation.
 */
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

/**
 * @description Executes the create supabase object key operation used by the application workflow.
 * @param {{ readonly sha256: string; readonly originalFilename: string; readonly contractId?: string; }} input - Input value for input.
 * @returns {string} Result of the create supabase object key operation.
 */
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
