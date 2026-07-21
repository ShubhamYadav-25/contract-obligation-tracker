import { readFile } from "node:fs/promises";
import path from "node:path";

const fixtureRoot = path.resolve(process.cwd(), "datasets");

export function resolveFixturePath(...segments: string[]): string {
  return path.resolve(fixtureRoot, ...segments);
}

export async function loadFixtureText(...segments: string[]): Promise<string> {
  return readFile(resolveFixturePath(...segments), "utf8");
}
