import { extractionOutputSchema } from "./extraction.schemas.js";

export class ExtractionService {
  validateModelOutput(output: unknown) {
    return extractionOutputSchema.safeParse(output);
  }
}
