import type { PdfSourceNavigationCommand } from "@/components/features/pdf-reader/pdf-source-navigation.js";

import type { ObligationSourceAnchor } from "../obligations/types/obligation.js";
import { formatStatusLabel } from "./components.js";

export interface ContractWorkspaceLocationState {
  readonly tab?: string;
  readonly obligationId?: string;
  readonly sourceCommand?: PdfSourceNavigationCommand;
}

export function sourceCommandFromAnchor(
  anchor: ObligationSourceAnchor | undefined,
): PdfSourceNavigationCommand | null {
  if (!anchor) return null;
  return {
    type: "PDF_NAVIGATE_TO_SOURCE",
    payload: {
      pageNumber: anchor.pageNumber,
      ...(anchor.startLine !== undefined ? { startLine: anchor.startLine } : {}),
      ...(anchor.endLine !== undefined ? { endLine: anchor.endLine } : {}),
      ...(anchor.quotedText ? { quotedText: anchor.quotedText } : {}),
      boxes: anchor.boxes,
    },
  };
}

export function sourceLinkState(
  anchor: ObligationSourceAnchor | undefined,
  obligationId?: string,
): ContractWorkspaceLocationState {
  const sourceCommand = sourceCommandFromAnchor(anchor);
  return {
    tab: "Review & Evidence",
    ...(obligationId ? { obligationId } : {}),
    ...(sourceCommand ? { sourceCommand } : {}),
  };
}

export function sourceAnchorLabel(anchor: ObligationSourceAnchor, index: number): string {
  const role = anchor.evidenceRole ? `${formatStatusLabel(anchor.evidenceRole)} ` : "";
  const lines =
    anchor.startLine !== undefined
      ? `:L${anchor.startLine}${anchor.endLine && anchor.endLine !== anchor.startLine ? `-${anchor.endLine}` : ""}`
      : "";
  return `${role}P${anchor.pageNumber}${lines}` || `Source ${index + 1}`;
}
