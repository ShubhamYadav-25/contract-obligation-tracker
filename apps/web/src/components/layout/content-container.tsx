import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

export function ContentContainer({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <div className={cx("mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10", className)}>
      {children}
    </div>
  );
}
