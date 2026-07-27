/**
 * @file Defines reusable layout components for the web shell.
 */
import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the content container component for the contract tracker UI.
 * @param {PropsWithChildren<{ readonly className?: string; }>} { children, className, } - Input value for { children, class name, }.
 * @returns {JSX.Element} Result of the content container operation.
 */
export function ContentContainer({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <div className={cx("mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10", className)}>
      {children}
    </div>
  );
}
