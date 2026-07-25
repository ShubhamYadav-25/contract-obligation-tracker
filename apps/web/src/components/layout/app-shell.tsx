/**
 * @file Defines reusable layout components for the web shell.
 */
import {
  Bell,
  ChevronRight,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { useAuthSession } from "../../features/auth/index.js";
import { cx } from "@/utils/cx.js";

const navigation = [
  { label: "Dashboard", to: routePaths.dashboard, icon: LayoutDashboard },
  { label: "Contracts", to: routePaths.contracts, icon: FileText },
  { label: "Obligations", to: routePaths.obligations, icon: ListChecks },
  { label: "Messages", to: routePaths.messages, icon: Inbox },
];

/**
 * @description Renders the sidebar component for the contract tracker UI.
 * @param {{ readonly onNavigate?: () => void }} { onNavigate } - Input value for { on navigate }.
 * @returns {JSX.Element} Result of the sidebar operation.
 */
function Sidebar({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { session } = useAuthSession();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Lexbridge Legal
        </p>
        <div className="mt-1 text-xl font-bold text-slate-950">Contract Tracker</div>
      </div>
      <nav aria-label="Primary navigation" className="space-y-1">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cx(
                "group relative flex h-11 items-center gap-3 rounded-md px-4 text-sm transition duration-150 ease-out focus-visible:shadow-focus",
                "before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r before:bg-transparent before:transition-colors",
                isActive
                  ? "bg-[#E6FFFA] font-bold text-teal-800 before:h-7 before:bg-teal-600"
                  : "font-medium text-slate-600 hover:bg-[#E0F2F1] hover:text-teal-700 hover:before:bg-teal-500",
              )
            }
            key={item.to}
            onClick={onNavigate}
            to={item.to}
          >
            <item.icon aria-hidden size={17} />
            <span className="min-w-0 flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-card">
        <div className="flex items-start gap-2 text-sm">
          <Bell aria-hidden className="mt-0.5 text-amber-700" size={16} />
          <div>
            <p className="font-semibold text-slate-900">Processing visibility</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Upload a PDF and monitor backend status.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card">
          <div
            aria-hidden
            className="grid size-10 place-items-center rounded-full bg-teal-700 text-sm font-bold text-white"
          >
            AR
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {session ? "Development Reviewer" : "No active session"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {import.meta.env.VITE_DEV_ORGANIZATION_ID
                ? "Development organization"
                : "Set auth env headers"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @description Renders the app shell component for the contract tracker UI.
 * @returns {JSX.Element} Result of the app shell operation.
 */
export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <Sidebar />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-slate-200 bg-white px-4 py-6 shadow-xl transition duration-200 ease-out">
            <button
              aria-label="Close navigation"
              className="absolute right-3 top-3 rounded-md p-2 transition hover:bg-slate-100 focus-visible:shadow-focus"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X aria-hidden size={18} />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                className="rounded-md p-2 transition hover:bg-slate-100 focus-visible:shadow-focus lg:hidden"
                onClick={() => setMobileOpen(true)}
                type="button"
              >
                <Menu aria-hidden size={20} />
              </button>
              <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
                <span>Workspace</span>
                <ChevronRight aria-hidden size={14} />
                <span className="font-semibold text-slate-900">Contract Operations</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Notifications"
                className="relative rounded-md border border-slate-200 bg-white p-2 shadow-card transition hover:bg-slate-50 focus-visible:shadow-focus"
                to={routePaths.messages}
              >
                <Bell aria-hidden size={17} />
                <span className="absolute right-1 top-1 size-2 rounded-full bg-red-600" />
              </Link>
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
