import { Badge } from "../../../components/ui/badge.js";

export function ConfidenceIndicator({ confidence }: { readonly confidence: number }) {
  const percent = Math.round(confidence * 100);
  const tone = percent >= 85 ? "success" : percent >= 60 ? "warning" : "danger";

  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{percent}% confidence</Badge>
      <div aria-label={`Confidence ${percent}%`} className="h-2 w-28 rounded bg-slate-200">
        <div
          className="h-2 rounded bg-accent"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
