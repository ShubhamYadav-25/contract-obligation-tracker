export function Skeleton({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div aria-label={label} className="animate-pulse space-y-3">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-1/2 rounded bg-slate-200" />
    </div>
  );
}
