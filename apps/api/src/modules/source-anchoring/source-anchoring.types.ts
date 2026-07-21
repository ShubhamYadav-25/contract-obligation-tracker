import type { ParsedDocument } from "../document-processing/document-processing.types.js";

export interface SourceAnchor {
  readonly pageNumber: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly quotedText: string;
}

export interface SourceAnchorValidationInput {
  readonly parsedDocument: ParsedDocument;
  readonly anchors: readonly SourceAnchor[];
}

export interface SourceAnchorValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly coverageRatio: number;
}
