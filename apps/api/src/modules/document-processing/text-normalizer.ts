/**
 * @file Defines backend document processing module contracts, services, routes, or persistence logic.
 */
/**
 * @description Performs the normalize extracted text helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {string} Result of the normalize extracted text operation.
 */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * @description Performs the split page lines helper operation for this module.
 * @param {number} pageNumber - Input value for page number.
 * @param {string} text - Input value for text.
 * @returns {unknown} Result of the split page lines operation.
 */
export function splitPageLines(pageNumber: number, text: string) {
  return normalizeExtractedText(text)
    .split("\n")
    .map((line, index) => ({
      pageNumber,
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text.length > 0);
}

/**
 * @description Performs the count words helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {number} Result of the count words operation.
 */
export function countWords(text: string): number {
  const matches = normalizeExtractedText(text).match(/\b[\p{L}\p{N}][\p{L}\p{N}'’.-]*\b/gu);
  return matches?.length ?? 0;
}

/**
 * @description Performs the printable character ratio helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {number} Result of the printable character ratio operation.
 */
export function printableCharacterRatio(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  const printableCount = [...text].filter((character) => {
    if (character === "\n" || character === "\t") {
      return true;
    }
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  }).length;

  return printableCount / [...text].length;
}
