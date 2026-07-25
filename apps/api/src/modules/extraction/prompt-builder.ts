/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type { ExtractionPromptInput } from "./extraction.types.js";

/**
 * @description Performs the build obligation extraction prompt helper operation for this module.
 * @param {ExtractionPromptInput} input - Input value for input.
 * @returns {string} Result of the build obligation extraction prompt operation.
 */
export function buildObligationExtractionPrompt(input: ExtractionPromptInput): string {
  const pages = input.parsedDocument.pages
    .map((page) => `Page ${page.pageNumber}\n${page.text}`)
    .join("\n\n");

  return [
    "Extract candidate contract obligations as untrusted structured data.",
    "Every obligation must include source anchors with page and line references.",
    "Do not infer obligations without supporting source text.",
    pages,
  ].join("\n\n");
}
