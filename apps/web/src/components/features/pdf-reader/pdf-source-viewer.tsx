import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "../../ui/button.js";

export interface SourceLine {
  readonly pageNumber: number;
  readonly lineNumber: number;
  readonly text: string;
}

export function PdfSourceViewer({
  initialPage = 1,
  lines,
  pageCount,
}: {
  readonly pageCount: number;
  readonly initialPage?: number;
  readonly lines: readonly SourceLine[];
}) {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const pageLines = lines.filter((line) => line.pageNumber === pageNumber);

  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Source text</h2>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous PDF page"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden size={16} />
          </Button>
          <span className="text-sm text-muted">
            Page {pageNumber} of {pageCount}
          </span>
          <Button
            aria-label="Next PDF page"
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
            type="button"
            variant="secondary"
          >
            <ChevronRight aria-hidden size={16} />
          </Button>
        </div>
      </div>
      <ol className="max-h-96 overflow-auto p-4 text-sm">
        {pageLines.map((line) => (
          <li
            className="grid grid-cols-[4rem_1fr] gap-3 border-b border-slate-100 py-2"
            key={line.lineNumber}
          >
            <span className="font-mono text-xs text-muted">L{line.lineNumber}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
