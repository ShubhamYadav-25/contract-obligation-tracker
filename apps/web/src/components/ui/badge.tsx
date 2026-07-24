import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly className?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  info: "bg-cyan-100 text-cyan-800",
};

export function Badge({ children, className, tone = "neutral" }: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={cx(
        "inline-flex min-h-6 items-center rounded px-2 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
