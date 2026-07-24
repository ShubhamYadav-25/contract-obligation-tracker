import React from "react";

export function TextPagesViewer({
  pages,
}: {
  readonly pages: { pageNumber: number; normalizedText: string }[];
}) {
  return (
    <div className="mt-6 space-y-6">
      {pages.map((p) => (
        <section
          key={p.pageNumber}
          aria-label={`page-${p.pageNumber}`}
          className="rounded border border-border p-3"
        >
          <h4 className="mb-2 text-sm font-semibold">Page {p.pageNumber}</h4>
          <div className="text-sm">
            {p.normalizedText.split(/\r?\n/).map((line, i) => (
              <div id={`page-${p.pageNumber}-line-${i}`} key={i} className="py-0.5">
                <span className="text-xs text-muted mr-3 inline-block w-12">{i + 1}</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
