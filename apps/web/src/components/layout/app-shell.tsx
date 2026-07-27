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
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { useAuthSession } from "../../features/auth/index.js";
import { cx } from "@/utils/cx.js";

const navigation = [
  { label: "Dashboard", to: routePaths.dashboard, icon: LayoutDashboard },
  { label: "Contracts", to: routePaths.contracts, icon: FileText },
  { label: "Obligations", to: routePaths.obligations, icon: ListChecks },
  { label: "Messages", to: routePaths.messages, icon: Inbox },
];

function currentSection(pathname: string): string {
  if (pathname.startsWith("/contracts")) return "Contracts";
  if (pathname.startsWith("/reviews")) return "Obligations";
  if (pathname.startsWith("/obligations")) return "Obligations";
  if (pathname.startsWith("/messages")) return "Messages";
  return "Dashboard";
}

/**
 * @description Renders the sidebar component for the contract tracker UI.
 * @param {{ readonly onNavigate?: () => void }} { onNavigate } - Input value for { on navigate }.
 * @returns {JSX.Element} Result of the sidebar operation.
 */
function Sidebar({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { session } = useAuthSession();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-7 px-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
          LEXBRIDGE LEGAL
        </p>
        <div className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">
          Contract Tracker
        </div>
        <p className="mt-1 text-sm text-slate-600">Obligation operations workspace</p>
      </div>
      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Workspace
      </p>
      <nav aria-label="Primary navigation" className="space-y-1">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cx(
                "group relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2",
                isActive
                  ? "bg-teal-50 font-bold text-teal-900 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-teal-700"
                  : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950",
              )
            }
            key={item.label}
            onClick={onNavigate}
            to={item.to}
          >
            <item.icon aria-hidden size={20} className="shrink-0 text-slate-600 group-hover:text-slate-950" />
            <span className="min-w-0 flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-7 rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-2.5 text-sm">
          <Bell aria-hidden className="mt-0.5 text-amber-700 shrink-0" size={16} />
          <div>
            <p className="font-semibold text-slate-900">Processing visibility</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Contract and obligation states are loaded from the active workspace.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="grid size-9 place-items-center rounded-full bg-teal-700 text-xs font-bold text-white shrink-0"
          >
            {session?.userId.slice(0, 2).toUpperCase() ?? "DEV"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {session ? "Development reviewer" : "No active session"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {session ? session.userId : "Configure development auth headers"}
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
  const location = useLocation();
  const section = currentSection(location.pathname);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-6 lg:block">
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
          <aside aria-label="Mobile navigation" className="relative h-full w-80 max-w-[88vw] border-r border-slate-200 bg-white px-4 py-6 shadow-xl">
            <button
              aria-label="Close navigation"
              className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X aria-hidden size={18} />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                className="grid size-11 place-items-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
                type="button"
              >
                <Menu aria-hidden size={20} />
              </button>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Workspace</span>
                <ChevronRight aria-hidden size={14} />
                <span aria-current="page" className="font-bold text-slate-950">{section}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Notifications"
                className="relative grid size-11 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-card transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                to={routePaths.messages}
              >
                <Bell aria-hidden size={17} />
                <span className="absolute right-1 top-1 size-2 rounded-full bg-red-600" />
              </Link>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
