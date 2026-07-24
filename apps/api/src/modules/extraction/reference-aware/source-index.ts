import type {
  DocumentTextExtractionMethod,
  DocumentTextSegment,
  ParsedDocumentPage,
} from "../../document-processing/document-processing.types.js";
import type { EvidenceRole } from "./reference-aware-extraction.schemas.js";

export type ContractSourceVerificationErrorCode =
  | "DUPLICATE_GLOBAL_LINE"
  | "EMPTY_SOURCE_INDEX"
  | "INVALID_GLOBAL_LINE"
  | "MISSING_END_LINE"
  | "MISSING_GLOBAL_LINE"
  | "MISSING_START_LINE"
  | "REVERSED_SPAN";

export interface ContractSourceVerificationError {
  readonly code: ContractSourceVerificationErrorCode;
  readonly message: string;
  readonly globalLineNumber: number | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
}

export interface ContractSourceLineInput {
  readonly globalLineNumber: number;
  readonly pageNumber: number;
  readonly pageLocalLineNumber?: number;
  readonly text: string;
  readonly normalizedText?: string;
  readonly sourceMethod: DocumentTextExtractionMethod;
  readonly sectionPath?: readonly string[];
}

export interface ContractSourceLine {
  readonly globalLineNumber: number;
  readonly pageNumber: number;
  readonly pageLocalLineNumber: number | null;
  readonly originalText: string;
  readonly normalizedText: string;
  readonly sourceMethod: DocumentTextExtractionMethod;
  readonly sectionPath: readonly string[];
}

export interface ResolvedEvidenceSpan {
  readonly startLine: number;
  readonly endLine: number;
  readonly startPage: number | null;
  readonly endPage: number | null;
  readonly exactQuote: string;
  readonly sourceLines: readonly ContractSourceLine[];
  readonly verificationErrors: readonly ContractSourceVerificationError[];
}

export interface EvidenceSpanReference {
  readonly startLine: number;
  readonly endLine: number;
  readonly evidenceRole: EvidenceRole;
}

export interface ResolvedEvidenceSpanWithRole extends ResolvedEvidenceSpan {
  readonly evidenceRole: EvidenceRole;
}

export function normalizeSourceLineText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

function error(input: {
  readonly code: ContractSourceVerificationErrorCode;
  readonly message: string;
  readonly globalLineNumber?: number;
  readonly startLine?: number;
  readonly endLine?: number;
}): ContractSourceVerificationError {
  return {
    code: input.code,
    message: input.message,
    globalLineNumber: input.globalLineNumber ?? null,
    startLine: input.startLine ?? null,
    endLine: input.endLine ?? null,
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function toSourceLine(input: ContractSourceLineInput): ContractSourceLine {
  return {
    globalLineNumber: input.globalLineNumber,
    pageNumber: input.pageNumber,
    pageLocalLineNumber: input.pageLocalLineNumber ?? null,
    originalText: input.text,
    normalizedText: normalizeSourceLineText(input.normalizedText ?? input.text),
    sourceMethod: input.sourceMethod,
    sectionPath: input.sectionPath ?? [],
  };
}

function splitNormalizedLines(text: string): readonly string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map(normalizeSourceLineText)
    .filter((line) => line.length > 0);
}

function sourceLinesFromPage(page: ParsedDocumentPage, nextGlobalLineNumber: number) {
  const inputs: ContractSourceLineInput[] = [];
  const pageLines =
    page.lines.length > 0
      ? page.lines.map((line) => ({
          pageLocalLineNumber: line.lineNumber,
          text: line.text,
        }))
      : splitNormalizedLines(page.normalizedText || page.rawText).map((line, index) => ({
          pageLocalLineNumber: index + 1,
          text: line,
        }));

  let globalLineNumber = nextGlobalLineNumber;
  for (const line of pageLines) {
    inputs.push({
      globalLineNumber,
      pageNumber: page.pageNumber,
      pageLocalLineNumber: line.pageLocalLineNumber,
      text: line.text,
      sourceMethod: page.extractionMethod,
    });
    globalLineNumber += 1;
  }

  return {
    inputs,
    nextGlobalLineNumber: globalLineNumber,
  };
}

function sourceLinesFromSegments(
  segments: readonly DocumentTextSegment[],
): readonly ContractSourceLineInput[] {
  const inputs: ContractSourceLineInput[] = [];
  let globalLineNumber = 1;

  for (const segment of segments) {
    const sectionPath = (segment as { readonly sectionPath?: readonly string[] }).sectionPath;
    const lines = splitNormalizedLines(segment.normalizedText || segment.text);
    for (const [index, line] of lines.entries()) {
      const pageLocalLineNumber =
        segment.lineStart + index <= segment.lineEnd ? segment.lineStart + index : undefined;
      inputs.push({
        globalLineNumber,
        pageNumber: segment.pageNumber,
        text: line,
        sourceMethod: segment.extractionMethod,
        ...(pageLocalLineNumber !== undefined ? { pageLocalLineNumber } : {}),
        ...(sectionPath ? { sectionPath } : {}),
      });
      globalLineNumber += 1;
    }
  }

  return inputs;
}

export class ContractSourceIndex {
  private readonly linesByGlobalLineNumber = new Map<number, ContractSourceLine>();
  readonly diagnostics: readonly ContractSourceVerificationError[];
  readonly lines: readonly ContractSourceLine[];

  constructor(lines: readonly ContractSourceLineInput[]) {
    const diagnostics: ContractSourceVerificationError[] = [];

    for (const lineInput of lines) {
      if (!isPositiveInteger(lineInput.globalLineNumber)) {
        diagnostics.push(
          error({
            code: "INVALID_GLOBAL_LINE",
            message: `Global line number ${lineInput.globalLineNumber} is not a positive integer`,
            globalLineNumber: lineInput.globalLineNumber,
          }),
        );
        continue;
      }

      if (this.linesByGlobalLineNumber.has(lineInput.globalLineNumber)) {
        diagnostics.push(
          error({
            code: "DUPLICATE_GLOBAL_LINE",
            message: `Global line ${lineInput.globalLineNumber} appears more than once`,
            globalLineNumber: lineInput.globalLineNumber,
          }),
        );
        continue;
      }

      this.linesByGlobalLineNumber.set(lineInput.globalLineNumber, toSourceLine(lineInput));
    }

    this.lines = [...this.linesByGlobalLineNumber.values()].sort(
      (left, right) => left.globalLineNumber - right.globalLineNumber,
    );

    if (this.lines.length === 0) {
      diagnostics.push(
        error({
          code: "EMPTY_SOURCE_INDEX",
          message: "Contract source index contains no lines",
        }),
      );
    } else {
      const first = this.lines[0]?.globalLineNumber ?? 1;
      const last = this.lines[this.lines.length - 1]?.globalLineNumber ?? first;
      for (let lineNumber = first; lineNumber <= last; lineNumber += 1) {
        if (!this.linesByGlobalLineNumber.has(lineNumber)) {
          diagnostics.push(
            error({
              code: "MISSING_GLOBAL_LINE",
              message: `Global line ${lineNumber} is missing from the source index`,
              globalLineNumber: lineNumber,
            }),
          );
        }
      }
    }

    this.diagnostics = diagnostics;
  }

  static fromParsedPages(pages: readonly ParsedDocumentPage[]): ContractSourceIndex {
    const sortedPages = [...pages].sort((left, right) => left.pageNumber - right.pageNumber);
    const inputs: ContractSourceLineInput[] = [];
    let nextGlobalLineNumber = 1;

    for (const page of sortedPages) {
      const result = sourceLinesFromPage(page, nextGlobalLineNumber);
      inputs.push(...result.inputs);
      nextGlobalLineNumber = result.nextGlobalLineNumber;
    }

    return new ContractSourceIndex(inputs);
  }

  static fromSegments(segments: readonly DocumentTextSegment[]): ContractSourceIndex {
    return new ContractSourceIndex(sourceLinesFromSegments(segments));
  }

  getLine(globalLineNumber: number): ContractSourceLine | null {
    return this.linesByGlobalLineNumber.get(globalLineNumber) ?? null;
  }

  resolveEvidenceSpan(startLine: number, endLine: number): ResolvedEvidenceSpan {
    const verificationErrors: ContractSourceVerificationError[] = [];

    if (!isPositiveInteger(startLine)) {
      verificationErrors.push(
        error({
          code: "INVALID_GLOBAL_LINE",
          message: `Start line ${startLine} is not a positive integer`,
          globalLineNumber: startLine,
          startLine,
          endLine,
        }),
      );
    }

    if (!isPositiveInteger(endLine)) {
      verificationErrors.push(
        error({
          code: "INVALID_GLOBAL_LINE",
          message: `End line ${endLine} is not a positive integer`,
          globalLineNumber: endLine,
          startLine,
          endLine,
        }),
      );
    }

    if (startLine > endLine) {
      verificationErrors.push(
        error({
          code: "REVERSED_SPAN",
          message: `Start line ${startLine} is greater than end line ${endLine}`,
          startLine,
          endLine,
        }),
      );
    }

    if (verificationErrors.length > 0) {
      return {
        startLine,
        endLine,
        startPage: null,
        endPage: null,
        exactQuote: "",
        sourceLines: [],
        verificationErrors,
      };
    }

    const sourceLines: ContractSourceLine[] = [];
    const startSourceLine = this.getLine(startLine);
    const endSourceLine = this.getLine(endLine);

    if (!startSourceLine) {
      verificationErrors.push(
        error({
          code: "MISSING_START_LINE",
          message: `Start line ${startLine} is missing from the source index`,
          globalLineNumber: startLine,
          startLine,
          endLine,
        }),
      );
    }

    if (!endSourceLine) {
      verificationErrors.push(
        error({
          code: "MISSING_END_LINE",
          message: `End line ${endLine} is missing from the source index`,
          globalLineNumber: endLine,
          startLine,
          endLine,
        }),
      );
    }

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const sourceLine = this.getLine(lineNumber);
      if (!sourceLine) {
        if (lineNumber !== startLine && lineNumber !== endLine) {
          verificationErrors.push(
            error({
              code: "MISSING_GLOBAL_LINE",
              message: `Global line ${lineNumber} is missing from the source span`,
              globalLineNumber: lineNumber,
              startLine,
              endLine,
            }),
          );
        }
        continue;
      }
      sourceLines.push(sourceLine);
    }

    return {
      startLine,
      endLine,
      startPage: startSourceLine?.pageNumber ?? sourceLines[0]?.pageNumber ?? null,
      endPage: endSourceLine?.pageNumber ?? sourceLines[sourceLines.length - 1]?.pageNumber ?? null,
      exactQuote: sourceLines.map((line) => line.normalizedText).join("\n"),
      sourceLines,
      verificationErrors,
    };
  }

  resolveEvidenceSpans(
    spans: readonly EvidenceSpanReference[],
  ): readonly ResolvedEvidenceSpanWithRole[] {
    const seen = new Set<string>();
    const resolved: ResolvedEvidenceSpanWithRole[] = [];

    for (const span of spans) {
      const key = `${span.evidenceRole}:${span.startLine}:${span.endLine}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      resolved.push({
        ...this.resolveEvidenceSpan(span.startLine, span.endLine),
        evidenceRole: span.evidenceRole,
      });
    }

    return resolved;
  }
}
