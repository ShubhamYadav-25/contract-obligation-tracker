import { Skeleton } from "../ui/skeleton.js";

export function LoadingState({ label = "Loading content" }: { readonly label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <Skeleton label={label} />
    </div>
  );
}
