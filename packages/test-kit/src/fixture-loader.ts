/**
 * @file Defines reusable test helpers, fixtures, and mock providers.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixtureRoot = path.resolve(process.cwd(), "datasets");

/**
 * @description Performs the resolve fixture path helper operation for this module.
 * @param {string[]} segments - Input value for segments.
 * @returns {string} Result of the resolve fixture path operation.
 */
export function resolveFixturePath(...segments: string[]): string {
  return path.resolve(fixtureRoot, ...segments);
}

/**
 * @description Performs the load fixture text helper operation for this module.
 * @param {string[]} segments - Input value for segments.
 * @returns {Promise<string>} Result of the load fixture text operation.
 */
export async function loadFixtureText(...segments: string[]): Promise<string> {
  return readFile(resolveFixturePath(...segments), "utf8");
}
