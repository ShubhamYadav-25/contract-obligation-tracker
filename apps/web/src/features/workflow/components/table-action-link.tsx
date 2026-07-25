/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { ContractWorkspaceLocationState } from "../source-navigation.js";

/**
 * @description Renders the table action link component for the contract tracker UI.
 * @param {{ readonly children: string; readonly icon: LucideIcon; readonly state?: ContractWorkspaceLocationState; readonly to: string; }} { children, icon: Icon, state, to, } - Input value for { children, icon: icon, state, to, }.
 * @returns {JSX.Element} Result of the table action link operation.
 */
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
