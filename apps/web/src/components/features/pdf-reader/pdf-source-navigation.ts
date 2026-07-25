/**
 * @file Defines PDF reader UI, navigation, and source highlight behavior.
 */
export interface PdfSourceBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PdfSourceNavigationCommand {
  readonly type: "PDF_NAVIGATE_TO_SOURCE";
  readonly payload: {
    readonly pageNumber: number;
    readonly startLine?: number;
    readonly endLine?: number;
    readonly quotedText?: string;
    readonly boxes: readonly PdfSourceBox[];
  };
}

export interface HighlightRect {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

/**
 * @description Performs the clamp unit helper operation for this module.
 * @param {number} value - Input value for value.
 * @returns {number} Result of the clamp unit operation.
 */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * @description Performs the normalize source box helper operation for this module.
 * @param {PdfSourceBox} box - Input value for box.
 * @returns {PdfSourceBox} Result of the normalize source box operation.
 */
export function normalizeSourceBox(box: PdfSourceBox): PdfSourceBox {
  const x = clampUnit(box.x);
  const y = clampUnit(box.y);
  const width = Math.min(clampUnit(box.width), 1 - x);
  const height = Math.min(clampUnit(box.height), 1 - y);
  return { x, y, width, height };
}

/**
 * @description Performs the to highlight rect helper operation for this module.
 * @param {PdfSourceBox} box - Input value for box.
 * @returns {HighlightRect} Result of the to highlight rect operation.
 */
export function toHighlightRect(box: PdfSourceBox): HighlightRect {
  const normalized = normalizeSourceBox(box);
  return {
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
    width: `${normalized.width * 100}%`,
    height: `${normalized.height * 100}%`,
  };
}

/**
 * @description Performs the is pdf source navigation command helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {value is PdfSourceNavigationCommand} Result of the is pdf source navigation command operation.
 */
export function isPdfSourceNavigationCommand(value: unknown): value is PdfSourceNavigationCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<PdfSourceNavigationCommand>;
  const payload = command.payload as Partial<PdfSourceNavigationCommand["payload"]> | undefined;
  return (
    command.type === "PDF_NAVIGATE_TO_SOURCE" &&
    typeof payload?.pageNumber === "number" &&
    payload.pageNumber > 0 &&
    (payload.startLine === undefined || typeof payload.startLine === "number") &&
    (payload.endLine === undefined || typeof payload.endLine === "number") &&
    (payload.quotedText === undefined || typeof payload.quotedText === "string") &&
    Array.isArray(payload.boxes)
  );
}
