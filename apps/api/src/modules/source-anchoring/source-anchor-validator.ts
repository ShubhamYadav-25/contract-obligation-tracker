/**
 * @file Defines backend source anchoring module contracts, services, routes, or persistence logic.
 */
import type {
  SourceAnchorValidationInput,
  SourceAnchorValidationResult,
} from "./source-anchoring.types.js";

export class SourceAnchorValidator {
  /**
   * @description Implements the validate method for this service or adapter.
   * @param {SourceAnchorValidationInput} input - Input value for input.
   * @returns {SourceAnchorValidationResult} Result of the validate operation.
   */
  validate(input: SourceAnchorValidationInput): SourceAnchorValidationResult {
    const issues: string[] = [];

    for (const anchor of input.anchors) {
      const page = input.parsedDocument.pages.find(
        (candidate) => candidate.pageNumber === anchor.pageNumber,
      );
      if (!page) {
        issues.push(`Page ${anchor.pageNumber} does not exist`);
        continue;
      }

      if (anchor.endLine < anchor.startLine) {
        issues.push(`Invalid line range on page ${anchor.pageNumber}`);
        continue;
      }

      const lineText = page.lines
        .filter((line) => line.lineNumber >= anchor.startLine && line.lineNumber <= anchor.endLine)
        .map((line) => line.text)
        .join(" ");

      if (!lineText.includes(anchor.quotedText)) {
        issues.push(`Quoted text does not match page ${anchor.pageNumber}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      coverageRatio:
        input.anchors.length === 0
          ? 0
          : (input.anchors.length - issues.length) / input.anchors.length,
    };
  }
}
