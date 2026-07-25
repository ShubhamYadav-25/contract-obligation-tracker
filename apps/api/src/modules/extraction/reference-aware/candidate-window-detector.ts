/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type {
  CandidateWindowSourceMethod,
  SourceLineRange,
} from "./reference-aware-extraction.schemas.js";
import type { ContractSourceIndex, ContractSourceLine } from "./source-index.js";

export interface CandidateWindowDetectionConfig {
  readonly precedingContextLineCount: number;
  readonly followingContextLineCount: number;
  readonly maxWindowLineCount: number;
  readonly maxWindowCharacters: number;
  readonly mergeGapLineCount: number;
}

export interface CandidateWindowCueMatch {
  readonly globalLineNumber: number;
  readonly cueTypes: readonly string[];
}

export interface DetectedCandidateWindow {
  readonly id: string;
  readonly globalStartLine: number;
  readonly globalEndLine: number;
  readonly targetGlobalLines: readonly number[];
  readonly contextSpans: readonly SourceLineRange[];
  readonly targetSpans: readonly SourceLineRange[];
  readonly sectionPath: readonly string[];
  readonly cueTypes: readonly string[];
  readonly characterCount: number;
  readonly sourceMethod: CandidateWindowSourceMethod;
  readonly sourceLines: readonly ContractSourceLine[];
}

interface MutableWindowDraft {
  startLine: number;
  endLine: number;
  readonly targetGlobalLines: Set<number>;
  readonly cueTypes: Set<string>;
  sectionPath: readonly string[];
}

const defaultConfig: CandidateWindowDetectionConfig = {
  precedingContextLineCount: 1,
  followingContextLineCount: 1,
  maxWindowLineCount: 8,
  maxWindowCharacters: 2_000,
  mergeGapLineCount: 0,
};

const dutyCuePatterns: readonly [string, RegExp][] = [
  ["shall", /\bshall\b/i],
  ["must", /\bmust\b/i],
  ["required_to", /\brequired\s+to\b/i],
  ["agrees_to", /\bagrees?\s+to\b/i],
  ["payable", /\bpayable\b/i],
  ["due", /\bdue\b/i],
  ["no_later_than", /\bno\s+later\s+than\b/i],
  [
    "within_time_period",
    /\bwithin\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|thirty|sixty|ninety)(?:\s*\(\d+\))?\s+(?:hour|hours|day|days|business\s+days|week|weeks|month|months|year|years)\b/i,
  ],
  [
    "before_after_event",
    /\b(?:before|after|following|prior\s+to)\s+(?:receipt|delivery|execution|expiration|termination|renewal|notice|invoice|the\s+\w+)/i,
  ],
  [
    "recurrence",
    /\b(?:daily|weekly|monthly|quarterly|annually|annual|yearly|recurring|each\s+(?:day|week|month|quarter|year))\b/i,
  ],
  ["operational_action", /\b(?:notify|deliver|submit|report|maintain|pay|return|provide)\b/i],
  ["renewal_termination_notice", /\b(?:renewal|renew|termination|terminate|notice)\b/i],
  [
    "expiration_termination",
    /\bupon\s+(?:expiration|termination)|(?:expiration|termination)\s+of\s+(?:this\s+)?agreement\b/i,
  ],
];

const matchingDutyCuePattern =
  /\b(?:shall|must|required\s+to|agrees?\s+to|payable|due|no\s+later\s+than|within\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|thirty|sixty|ninety)|notify|deliver|submit|report|maintain|pay|return|provide)\b/i;

/**
 * @description Performs the is definition only line helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is definition only line operation.
 */
function isDefinitionOnlyLine(text: string): boolean {
  return /\bshall\s+mean\b/i.test(text) || /^["'A-Z][^.;:]{0,120}\bmeans\b/i.test(text);
}

/**
 * @description Performs the is section heading helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is section heading operation.
 */
function isSectionHeading(text: string): boolean {
  if (text.length > 120 || /[.;]$/.test(text)) {
    return false;
  }
  return /^(?:section|article|schedule|exhibit)\s+[A-Z0-9IVXLC]+(?:[.\-:]\s*)?[A-Za-z0-9 ,/&()-]*$/i.test(
    text,
  );
}

/**
 * @description Performs the is table of contents entry helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is table of contents entry operation.
 */
function isTableOfContentsEntry(text: string): boolean {
  return /\btable\s+of\s+contents\b/i.test(text) || /\.{3,}\s*\d+\s*$/.test(text);
}

/**
 * @description Performs the is recital helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is recital operation.
 */
function isRecital(text: string): boolean {
  return /^(?:recitals?|whereas)\b/i.test(text);
}

/**
 * @description Performs the is interpretation boilerplate helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is interpretation boilerplate operation.
 */
function isInterpretationBoilerplate(text: string): boolean {
  return /\b(?:unless\s+the\s+context\s+otherwise\s+requires|including\s+without\s+limitation|references\s+to\s+sections?|headings\s+are\s+for\s+convenience)\b/i.test(
    text,
  );
}

/**
 * @description Performs the is standalone may right helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is standalone may right operation.
 */
function isStandaloneMayRight(text: string): boolean {
  return /\bmay\b/i.test(text) && !matchingDutyCuePattern.test(text);
}

/**
 * @description Performs the is excluded target helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {boolean} Result of the is excluded target operation.
 */
function isExcludedTarget(text: string): boolean {
  return (
    isDefinitionOnlyLine(text) ||
    isSectionHeading(text) ||
    isTableOfContentsEntry(text) ||
    isRecital(text) ||
    isInterpretationBoilerplate(text) ||
    isStandaloneMayRight(text)
  );
}

/**
 * @description Performs the find cue types helper operation for this module.
 * @param {ContractSourceLine} line - Input value for line.
 * @returns {readonly string[]} Result of the find cue types operation.
 */
function findCueTypes(line: ContractSourceLine): readonly string[] {
  if (isExcludedTarget(line.normalizedText)) {
    return [];
  }
  return dutyCuePatterns
    .filter(([, pattern]) => pattern.test(line.normalizedText))
    .map(([cueType]) => cueType);
}

/**
 * @description Performs the sorted unique numbers helper operation for this module.
 * @param {Iterable<number>} values - Input value for values.
 * @returns {readonly number[]} Result of the sorted unique numbers operation.
 */
function sortedUniqueNumbers(values: Iterable<number>): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

/**
 * @description Performs the sorted unique strings helper operation for this module.
 * @param {Iterable<string>} values - Input value for values.
 * @returns {readonly string[]} Result of the sorted unique strings operation.
 */
function sortedUniqueStrings(values: Iterable<string>): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * @description Performs the same section helper operation for this module.
 * @param {readonly string[]} leftSectionPath - Input value for left section path.
 * @param {readonly string[]} rightSectionPath - Input value for right section path.
 * @returns {boolean} Result of the same section operation.
 */
function sameSection(
  leftSectionPath: readonly string[],
  rightSectionPath: readonly string[],
): boolean {
  return (
    leftSectionPath.length > 0 &&
    leftSectionPath.length === rightSectionPath.length &&
    leftSectionPath.every((value, index) => value === rightSectionPath[index])
  );
}

/**
 * @description Performs the should merge windows helper operation for this module.
 * @param {MutableWindowDraft} current - Input value for current.
 * @param {MutableWindowDraft} next - Input value for next.
 * @param {CandidateWindowDetectionConfig} config - Input value for config.
 * @returns {boolean} Result of the should merge windows operation.
 */
function shouldMergeWindows(
  current: MutableWindowDraft,
  next: MutableWindowDraft,
  config: CandidateWindowDetectionConfig,
): boolean {
  const currentTargets = sortedUniqueNumbers(current.targetGlobalLines);
  const nextTargets = sortedUniqueNumbers(next.targetGlobalLines);
  const currentLastTarget = currentTargets[currentTargets.length - 1] ?? current.endLine;
  const nextFirstTarget = nextTargets[0] ?? next.startLine;
  const targetGap = nextFirstTarget - currentLastTarget - 1;

  if (next.startLine <= current.endLine + 1 && targetGap <= 0) {
    return true;
  }
  if (targetGap <= config.mergeGapLineCount) {
    return true;
  }
  return (
    sameSection(current.sectionPath, next.sectionPath) && targetGap <= config.mergeGapLineCount
  );
}

/**
 * @description Performs the merge drafts helper operation for this module.
 * @param {MutableWindowDraft} left - Input value for left.
 * @param {MutableWindowDraft} right - Input value for right.
 * @returns {MutableWindowDraft} Result of the merge drafts operation.
 */
function mergeDrafts(left: MutableWindowDraft, right: MutableWindowDraft): MutableWindowDraft {
  return {
    startLine: Math.min(left.startLine, right.startLine),
    endLine: Math.max(left.endLine, right.endLine),
    targetGlobalLines: new Set([...left.targetGlobalLines, ...right.targetGlobalLines]),
    cueTypes: new Set([...left.cueTypes, ...right.cueTypes]),
    sectionPath: left.sectionPath.length > 0 ? left.sectionPath : right.sectionPath,
  };
}

/**
 * @description Performs the find line index helper operation for this module.
 * @param {readonly ContractSourceLine[]} lines - Input value for lines.
 * @param {number} globalLineNumber - Input value for global line number.
 * @returns {number} Result of the find line index operation.
 */
function findLineIndex(lines: readonly ContractSourceLine[], globalLineNumber: number): number {
  return lines.findIndex((line) => line.globalLineNumber === globalLineNumber);
}

/**
 * @description Performs the character count helper operation for this module.
 * @param {readonly ContractSourceLine[]} lines - Input value for lines.
 * @returns {number} Result of the character count operation.
 */
function characterCount(lines: readonly ContractSourceLine[]): number {
  return lines.reduce(
    (count, line, index) => count + line.normalizedText.length + (index > 0 ? 1 : 0),
    0,
  );
}

/**
 * @description Performs the clamp draft to bounds helper operation for this module.
 * @param {MutableWindowDraft} draft - Input value for draft.
 * @param {readonly ContractSourceLine[]} lines - Input value for lines.
 * @param {CandidateWindowDetectionConfig} config - Input value for config.
 * @returns {MutableWindowDraft} Result of the clamp draft to bounds operation.
 */
function clampDraftToBounds(
  draft: MutableWindowDraft,
  lines: readonly ContractSourceLine[],
  config: CandidateWindowDetectionConfig,
): MutableWindowDraft {
  const targetLines = sortedUniqueNumbers(draft.targetGlobalLines);
  const firstTarget = targetLines[0] ?? draft.startLine;
  const lastTarget = targetLines[targetLines.length - 1] ?? draft.endLine;
  let startLine = draft.startLine;
  let endLine = draft.endLine;

  /**
   * @description Performs the window lines helper operation for this module.
   * @returns {unknown} Result of the window lines operation.
   */
  function windowLines() {
    return lines.filter(
      (line) => line.globalLineNumber >= startLine && line.globalLineNumber <= endLine,
    );
  }

  while (windowLines().length > config.maxWindowLineCount && startLine < firstTarget) {
    startLine += 1;
  }
  while (windowLines().length > config.maxWindowLineCount && endLine > lastTarget) {
    endLine -= 1;
  }
  while (characterCount(windowLines()) > config.maxWindowCharacters && startLine < firstTarget) {
    startLine += 1;
  }
  while (characterCount(windowLines()) > config.maxWindowCharacters && endLine > lastTarget) {
    endLine -= 1;
  }

  return {
    ...draft,
    startLine,
    endLine,
  };
}

/**
 * @description Performs the to source line ranges helper operation for this module.
 * @param {readonly ContractSourceLine[]} lines - Input value for lines.
 * @returns {readonly SourceLineRange[]} Result of the to source line ranges operation.
 */
function toSourceLineRanges(lines: readonly ContractSourceLine[]): readonly SourceLineRange[] {
  const sortedLines = [...lines].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      (left.pageLocalLineNumber ?? left.globalLineNumber) -
        (right.pageLocalLineNumber ?? right.globalLineNumber),
  );
  const ranges: SourceLineRange[] = [];

  for (const line of sortedLines) {
    const lineNumber = line.pageLocalLineNumber ?? line.globalLineNumber;
    const previous = ranges[ranges.length - 1];
    if (previous?.pageNumber === line.pageNumber && previous.endLine + 1 === lineNumber) {
      ranges[ranges.length - 1] = {
        ...previous,
        endLine: lineNumber,
      };
      continue;
    }
    ranges.push({
      pageNumber: line.pageNumber,
      startLine: lineNumber,
      endLine: lineNumber,
    });
  }

  return ranges;
}

/**
 * @description Performs the stable hash helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string} Result of the stable hash operation.
 */
function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * @description Performs the to window id helper operation for this module.
 * @param {{ readonly startLine: number; readonly endLine: number; readonly targetGlobalLines: readonly number[]; readonly cueTypes: readonly string[]; readonly sectionPath: readonly string[]; }} input - Input value for input.
 * @returns {string} Result of the to window id operation.
 */
function toWindowId(input: {
  readonly startLine: number;
  readonly endLine: number;
  readonly targetGlobalLines: readonly number[];
  readonly cueTypes: readonly string[];
  readonly sectionPath: readonly string[];
}): string {
  return `cw_${input.startLine}_${input.endLine}_${stableHash(JSON.stringify(input))}`;
}

/**
 * @description Performs the source method for window helper operation for this module.
 * @param {readonly ContractSourceLine[]} targetLines - Input value for target lines.
 * @param {readonly ContractSourceLine[]} sourceLines - Input value for source lines.
 * @returns {CandidateWindowSourceMethod} Result of the source method for window operation.
 */
function sourceMethodForWindow(
  targetLines: readonly ContractSourceLine[],
  sourceLines: readonly ContractSourceLine[],
): CandidateWindowSourceMethod {
  return (targetLines[0] ?? sourceLines[0])?.sourceMethod ?? "PDF_TEXT";
}

/**
 * @description Performs the to detected window helper operation for this module.
 * @param {MutableWindowDraft} draft - Input value for draft.
 * @param {readonly ContractSourceLine[]} lines - Input value for lines.
 * @param {CandidateWindowDetectionConfig} config - Input value for config.
 * @returns {DetectedCandidateWindow} Result of the to detected window operation.
 */
function toDetectedWindow(
  draft: MutableWindowDraft,
  lines: readonly ContractSourceLine[],
  config: CandidateWindowDetectionConfig,
): DetectedCandidateWindow {
  const boundedDraft = clampDraftToBounds(draft, lines, config);
  const sourceLines = lines.filter(
    (line) =>
      line.globalLineNumber >= boundedDraft.startLine &&
      line.globalLineNumber <= boundedDraft.endLine,
  );
  const targetGlobalLines = sortedUniqueNumbers(boundedDraft.targetGlobalLines);
  const targetLines = targetGlobalLines
    .map((globalLineNumber) => lines.find((line) => line.globalLineNumber === globalLineNumber))
    .filter((line): line is ContractSourceLine => Boolean(line));
  const cueTypes = sortedUniqueStrings(boundedDraft.cueTypes);
  const sectionPath = boundedDraft.sectionPath;

  return {
    id: toWindowId({
      startLine: boundedDraft.startLine,
      endLine: boundedDraft.endLine,
      targetGlobalLines,
      cueTypes,
      sectionPath,
    }),
    globalStartLine: boundedDraft.startLine,
    globalEndLine: boundedDraft.endLine,
    targetGlobalLines,
    contextSpans: toSourceLineRanges(
      sourceLines.filter((line) => !targetGlobalLines.includes(line.globalLineNumber)),
    ),
    targetSpans: toSourceLineRanges(targetLines),
    sectionPath,
    cueTypes,
    characterCount: characterCount(sourceLines),
    sourceMethod: sourceMethodForWindow(targetLines, sourceLines),
    sourceLines,
  };
}

/**
 * @description Performs the detect candidate window cue helper operation for this module.
 * @param {ContractSourceLine} line - Input value for line.
 * @returns {CandidateWindowCueMatch | null} Result of the detect candidate window cue operation.
 */
export function detectCandidateWindowCue(line: ContractSourceLine): CandidateWindowCueMatch | null {
  const cueTypes = findCueTypes(line);
  return cueTypes.length > 0
    ? {
        globalLineNumber: line.globalLineNumber,
        cueTypes,
      }
    : null;
}

/**
 * @description Performs the detect candidate windows helper operation for this module.
 * @param {ContractSourceIndex} sourceIndex - Input value for source index.
 * @param {Partial<CandidateWindowDetectionConfig>} overrideConfig - Input value for override config.
 * @returns {readonly DetectedCandidateWindow[]} Result of the detect candidate windows operation.
 */
export function detectCandidateWindows(
  sourceIndex: ContractSourceIndex,
  overrideConfig: Partial<CandidateWindowDetectionConfig> = {},
): readonly DetectedCandidateWindow[] {
  const config = { ...defaultConfig, ...overrideConfig };
  const lines = [...sourceIndex.lines].sort(
    (left, right) => left.globalLineNumber - right.globalLineNumber,
  );
  const drafts = lines
    .map((line): MutableWindowDraft | null => {
      const cue = detectCandidateWindowCue(line);
      if (!cue) return null;

      const lineIndex = findLineIndex(lines, line.globalLineNumber);
      const startLine =
        lines[Math.max(0, lineIndex - config.precedingContextLineCount)]?.globalLineNumber ??
        line.globalLineNumber;
      const endLine =
        lines[Math.min(lines.length - 1, lineIndex + config.followingContextLineCount)]
          ?.globalLineNumber ?? line.globalLineNumber;

      return {
        startLine,
        endLine,
        targetGlobalLines: new Set([line.globalLineNumber]),
        cueTypes: new Set(cue.cueTypes),
        sectionPath: line.sectionPath,
      };
    })
    .filter((draft): draft is MutableWindowDraft => Boolean(draft))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);

  const mergedDrafts: MutableWindowDraft[] = [];
  for (const draft of drafts) {
    const previous = mergedDrafts[mergedDrafts.length - 1];
    if (previous && shouldMergeWindows(previous, draft, config)) {
      mergedDrafts[mergedDrafts.length - 1] = mergeDrafts(previous, draft);
      continue;
    }
    mergedDrafts.push(draft);
  }

  return mergedDrafts.map((draft) => toDetectedWindow(draft, lines, config));
}

/**
 * @description Performs the render candidate window for llm helper operation for this module.
 * @param {DetectedCandidateWindow} window - Input value for window.
 * @returns {string} Result of the render candidate window for llm operation.
 */
export function renderCandidateWindowForLlm(window: DetectedCandidateWindow): string {
  return window.sourceLines
    .map((line) => {
      const pageLocalLine =
        line.pageLocalLineNumber !== null ? `L${line.pageLocalLineNumber}` : "L?";
      const marker = window.targetGlobalLines.includes(line.globalLineNumber) ? "*" : " ";
      return `${marker} G${line.globalLineNumber} P${line.pageNumber}:${pageLocalLine} ${line.normalizedText}`;
    })
    .join("\n");
}
