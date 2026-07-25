/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { SelectHTMLAttributes } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the select component for the contract tracker UI.
 * @param {SelectHTMLAttributes<HTMLSelectElement>} { className, ...props } - Input value for { class name, ...props }.
 * @returns {JSX.Element} Result of the select operation.
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-ink shadow-sm transition hover:border-slate-400 focus:border-teal-500 focus:outline-none focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
