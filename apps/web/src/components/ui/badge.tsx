/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
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

/**
 * @description Renders the badge component for the contract tracker UI.
 * @param {PropsWithChildren<BadgeProps>} { children, className, tone = "neutral" } - Input value for { children, class name, tone = "neutral" }.
 * @returns {JSX.Element} Result of the badge operation.
 */
export function Badge({ children, className, tone = "neutral" }: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center rounded-md px-2.5 py-1 text-[0.8125rem] font-bold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
