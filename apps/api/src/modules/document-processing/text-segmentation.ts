/**
 * @file Defines backend document processing module contracts, services, routes, or persistence logic.
 */
import type {
  DocumentTextSegment,
  ParsedDocumentPage,
  SegmentedDocumentPage,
} from "./document-processing.types.js";
import { normalizeExtractedText } from "./text-normalizer.js";

export interface TextSegmentationConfig {
  readonly maxSegmentCharacters: number;
  readonly lineOverlap: number;
}

interface SourceLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly normalizedText: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

/**
 * @description Performs the split lines with offsets helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {readonly SourceLine[]} Result of the split lines with offsets operation.
 */
function splitLinesWithOffsets(text: string): readonly SourceLine[] {
  const normalizedPageText = normalizeExtractedText(text);
  const lines: SourceLine[] = [];
  let searchOffset = 0;

  for (const [index, rawLine] of normalizedPageText.split("\n").entries()) {
    const normalizedText = normalizeExtractedText(rawLine);
    if (!normalizedText) {
      searchOffset += rawLine.length + 1;
      continue;
    }

    const startOffset = normalizedPageText.indexOf(normalizedText, searchOffset);
    const safeStartOffset = startOffset >= 0 ? startOffset : searchOffset;
    const endOffset = safeStartOffset + normalizedText.length;
    lines.push({
      lineNumber: index + 1,
      text: rawLine.trim(),
      normalizedText,
      startOffset: safeStartOffset,
      endOffset,
    });
    searchOffset = endOffset;
  }

  if (lines.length === 0 && normalizedPageText) {
    lines.push({
      lineNumber: 1,
      text: normalizedPageText,
      normalizedText: normalizedPageText,
      startOffset: 0,
      endOffset: normalizedPageText.length,
    });
  }

  return lines;
}

/**
 * @description Performs the next sentence boundary helper operation for this module.
 * @param {string} text - Input value for text.
 * @param {number} limit - Input value for limit.
 * @returns {number} Result of the next sentence boundary operation.
 */
function nextSentenceBoundary(text: string, limit: number): number {
  const candidate = text.slice(0, limit + 1).search(/[.!?;:]\s+[A-Z0-9(]/);
  if (candidate > 0) {
    return candidate + 1;
  }

  const lastSpace = text.lastIndexOf(" ", limit);
  return lastSpace > 0 ? lastSpace : limit;
}

/**
 * @description Performs the split oversized line helper operation for this module.
 * @param {ParsedDocumentPage} page - Input value for page.
 * @param {SourceLine} line - Input value for line.
 * @param {number} maxSegmentCharacters - Input value for max segment characters.
 * @returns {readonly DocumentTextSegment[]} Result of the split oversized line operation.
 */
function splitOversizedLine(
  page: ParsedDocumentPage,
  line: SourceLine,
  maxSegmentCharacters: number,
): readonly DocumentTextSegment[] {
  const segments: DocumentTextSegment[] = [];
  let remaining = line.normalizedText;
  let startOffset = line.startOffset;

  while (remaining.length > 0) {
    const take =
      remaining.length > maxSegmentCharacters
        ? nextSentenceBoundary(remaining, maxSegmentCharacters)
        : remaining.length;
    const text = remaining.slice(0, take).trim();
    if (text) {
      segments.push({
        documentId: page.documentId,
        pageNumber: page.pageNumber,
        lineStart: line.lineNumber,
        lineEnd: line.lineNumber,
        text,
        normalizedText: normalizeExtractedText(text),
        startOffset,
        endOffset: startOffset + text.length,
        extractionMethod: page.extractionMethod,
      });
    }

    remaining = remaining.slice(take).trimStart();
    startOffset = line.endOffset - remaining.length;
  }

  return segments;
}

/**
 * @description Performs the segment page text helper operation for this module.
 * @param {ParsedDocumentPage} page - Input value for page.
 * @param {TextSegmentationConfig} config - Input value for config.
 * @returns {readonly DocumentTextSegment[]} Result of the segment page text operation.
 */
export function segmentPageText(
  page: ParsedDocumentPage,
  config: TextSegmentationConfig,
): readonly DocumentTextSegment[] {
  const lines = splitLinesWithOffsets(page.normalizedText);
  const segments: DocumentTextSegment[] = [];
  let index = 0;

  while (index < lines.length) {
    const firstLine = lines[index];
    if (!firstLine) {
      break;
    }

    if (firstLine.normalizedText.length > config.maxSegmentCharacters) {
      segments.push(...splitOversizedLine(page, firstLine, config.maxSegmentCharacters));
      index += 1;
      continue;
    }

    const group = [firstLine];
    let candidateText = firstLine.normalizedText;
    let cursor = index + 1;

    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (!nextLine) {
        break;
      }

      const combined = `${candidateText}\n${nextLine.normalizedText}`;
      if (combined.length > config.maxSegmentCharacters) {
        break;
      }

      group.push(nextLine);
      candidateText = combined;
      cursor += 1;
    }

    const lastLine = group[group.length - 1] ?? firstLine;
    segments.push({
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      lineStart: firstLine.lineNumber,
      lineEnd: lastLine.lineNumber,
      text: group.map((line) => line.text).join("\n"),
      normalizedText: candidateText,
      startOffset: firstLine.startOffset,
      endOffset: lastLine.endOffset,
      extractionMethod: page.extractionMethod,
    });

    const overlappedIndex = cursor - Math.min(config.lineOverlap, Math.max(group.length - 1, 0));
    index = Math.max(overlappedIndex, index + 1);
  }

  return segments;
}

/**
 * @description Performs the segment document pages helper operation for this module.
 * @param {readonly ParsedDocumentPage[]} pages - Input value for pages.
 * @param {TextSegmentationConfig} config - Input value for config.
 * @returns {readonly SegmentedDocumentPage[]} Result of the segment document pages operation.
 */
export function segmentDocumentPages(
  pages: readonly ParsedDocumentPage[],
  config: TextSegmentationConfig,
): readonly SegmentedDocumentPage[] {
  return pages.map((page) => ({
    ...page,
    segments: segmentPageText(page, config),
  }));
}
