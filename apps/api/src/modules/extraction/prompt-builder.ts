import type { ExtractionPromptInput } from "./extraction.types.js";

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
