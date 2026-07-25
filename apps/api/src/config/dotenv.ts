/**
 * @file Defines backend runtime configuration and environment helpers.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * @description Performs the find dot env file helper operation for this module.
 * @param {string} startDirectory - Input value for start directory.
 * @returns {string | null} Result of the find dot env file operation.
 */
function findDotEnvFile(startDirectory: string): string | null {
  let current = resolve(startDirectory);

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }

  return null;
}

/**
 * @description Performs the load dot env file helper operation for this module.
 * @param {unknown} startDirectory - Input value for start directory.
 * @returns {void} Result of the load dot env file operation.
 */
export function loadDotEnvFile(startDirectory = process.cwd()): void {
  const envFile = findDotEnvFile(startDirectory);
  if (!envFile) {
    return;
  }

  const lines = readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}
