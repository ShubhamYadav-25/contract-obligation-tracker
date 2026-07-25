/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import { extractionOutputSchema } from "./extraction.schemas.js";

export class ExtractionService {
  /**
   * @description Implements the validate model output method for this service or adapter.
   * @param {unknown} output - Input value for output.
   * @returns {unknown} Result of the validate model output operation.
   */
  validateModelOutput(output: unknown) {
    return extractionOutputSchema.safeParse(output);
  }
}
