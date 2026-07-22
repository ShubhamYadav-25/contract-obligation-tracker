export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

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

export function countWords(text: string): number {
  const matches = normalizeExtractedText(text).match(/\b[\p{L}\p{N}][\p{L}\p{N}'’.-]*\b/gu);
  return matches?.length ?? 0;
}

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
