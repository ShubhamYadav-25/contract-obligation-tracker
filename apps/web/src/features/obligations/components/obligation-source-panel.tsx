/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { Card } from "@/components/ui/card.js";

/**
 * @description Renders the obligation source panel component for the contract tracker UI.
 * @param {{ readonly sourceText: string }} { sourceText } - Input value for { source text }.
 * @returns {JSX.Element} Result of the obligation source panel operation.
 */
export function ObligationSourcePanel({ sourceText }: { readonly sourceText: string }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Source text</h2>
      <p className="whitespace-pre-wrap text-sm text-muted">
        {sourceText || "No source text available."}
      </p>
    </Card>
  );
}
