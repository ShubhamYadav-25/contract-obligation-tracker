/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Card } from "@/components/ui/card.js";
import type { ReviewSourceAnchor } from "../types/review-candidate.js";

/**
 * @description Renders the source evidence panel component for the contract tracker UI.
 * @param {{ readonly anchors: readonly ReviewSourceAnchor[]; }} { anchors, } - Input value for { anchors, }.
 * @returns {JSX.Element} Result of the source evidence panel operation.
 */
export function SourceEvidencePanel({
  anchors,
}: {
  readonly anchors: readonly ReviewSourceAnchor[];
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Source evidence</h2>
      <div className="space-y-3">
        {anchors.map((anchor) => (
          <blockquote
            className="rounded-md border border-border bg-surface p-3 text-sm"
            key={`${anchor.pageNumber}-${anchor.startLine}`}
          >
            <p className="font-medium">
              Page {anchor.pageNumber}, lines {anchor.startLine}-{anchor.endLine}
            </p>
            <p className="mt-1 text-muted">{anchor.quotedText}</p>
          </blockquote>
        ))}
      </div>
    </Card>
  );
}
