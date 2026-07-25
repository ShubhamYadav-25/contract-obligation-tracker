/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the table component for the contract tracker UI.
 * @param {PropsWithChildren<{ readonly className?: string; }>} { children, className, } - Input value for { children, class name, }.
 * @returns {JSX.Element} Result of the table operation.
 */
export function Table({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className={cx("min-w-full divide-y divide-border text-left text-sm", className)}>
        {children}
      </table>
    </div>
  );
}
