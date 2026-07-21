export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
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
