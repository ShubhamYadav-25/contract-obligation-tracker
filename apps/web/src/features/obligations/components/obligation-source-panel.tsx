import { Card } from "../../../components/ui/card.js";

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
