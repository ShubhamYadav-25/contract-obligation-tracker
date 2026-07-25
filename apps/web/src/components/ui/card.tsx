/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the card component for the contract tracker UI.
 * @param {PropsWithChildren<{ readonly className?: string; }>} { children, className, } - Input value for { children, class name, }.
 * @returns {JSX.Element} Result of the card operation.
 */
export function Card({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <section className={cx("rounded-lg border border-border bg-white p-5", className)}>
      {children}
    </section>
  );
}
