/**
 * @file Defines reusable feedback components for loading, empty, retry, or error states.
 */
import { Skeleton } from "../ui/skeleton.js";

/**
 * @description Renders the loading state component for the contract tracker UI.
 * @param {{ readonly label?: string }} { label = "Loading content" } - Input value for { label = "loading content" }.
 * @returns {JSX.Element} Result of the loading state operation.
 */
export function LoadingState({ label = "Loading content" }: { readonly label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <Skeleton label={label} />
    </div>
  );
}
