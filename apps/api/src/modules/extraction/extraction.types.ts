import type { ParsedDocument } from "../document-processing/document-processing.types.js";

export interface ExtractionPromptInput {
  readonly parsedDocument: ParsedDocument;
}

export interface ExtractionCandidate {
  readonly id: string;
  readonly contractId: string;
  readonly status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  readonly extractedJson: unknown;
  readonly confidence: number;
  readonly validationIssues: readonly string[];
}
