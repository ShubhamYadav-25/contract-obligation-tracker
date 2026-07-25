/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
/**
 * @description Renders the skeleton component for the contract tracker UI.
 * @param {{ readonly label?: string }} { label = "Loading" } - Input value for { label = "loading" }.
 * @returns {JSX.Element} Result of the skeleton operation.
 */
export function Skeleton({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div aria-label={label} className="animate-pulse space-y-3">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-1/2 rounded bg-slate-200" />
    </div>
  );
}
