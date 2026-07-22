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
    readonly boxes: readonly PdfSourceBox[];
  };
}

export interface HighlightRect {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeSourceBox(box: PdfSourceBox): PdfSourceBox {
  const x = clampUnit(box.x);
  const y = clampUnit(box.y);
  const width = Math.min(clampUnit(box.width), 1 - x);
  const height = Math.min(clampUnit(box.height), 1 - y);
  return { x, y, width, height };
}

export function toHighlightRect(box: PdfSourceBox): HighlightRect {
  const normalized = normalizeSourceBox(box);
  return {
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
    width: `${normalized.width * 100}%`,
    height: `${normalized.height * 100}%`,
  };
}

export function isPdfSourceNavigationCommand(
  value: unknown,
): value is PdfSourceNavigationCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<PdfSourceNavigationCommand>;
  const payload = command.payload as Partial<PdfSourceNavigationCommand["payload"]> | undefined;
  return (
    command.type === "PDF_NAVIGATE_TO_SOURCE" &&
    typeof payload?.pageNumber === "number" &&
    payload.pageNumber > 0 &&
    Array.isArray(payload.boxes)
  );
}
