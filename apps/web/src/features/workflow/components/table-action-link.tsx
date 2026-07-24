import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { ContractWorkspaceLocationState } from "../source-navigation.js";

export function TableActionLink({
  children,
  icon: Icon,
  state,
  to,
}: {
  readonly children: string;
  readonly icon: LucideIcon;
  readonly state?: ContractWorkspaceLocationState;
  readonly to: string;
}) {
  return (
    <Link
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition duration-150 ease-out hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 focus-visible:shadow-focus active:translate-y-px"
      state={state}
      to={to}
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
