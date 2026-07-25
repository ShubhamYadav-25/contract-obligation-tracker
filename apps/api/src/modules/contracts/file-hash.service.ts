/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { createHash } from "node:crypto";

export class FileHashService {
  /**
   * @description Implements the sha256 method for this service or adapter.
   * @param {Buffer} input - Input value for input.
   * @returns {string} Result of the sha256 operation.
   */
  sha256(input: Buffer): string {
    return createHash("sha256").update(input).digest("hex");
  }
}
