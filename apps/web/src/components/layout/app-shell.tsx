import {
  Bell,
  ChevronRight,
  FileText,
  LayoutDashboard,
  ListChecks,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { routePaths } from "../../app/route-paths.js";
import { useAuthSession } from "../../features/auth/index.js";
import { cx } from "../../utils/cx.js";

const navigation = [
  { label: "Dashboard", to: routePaths.dashboard, icon: LayoutDashboard },
  { label: "Contracts", to: routePaths.contracts, icon: FileText },
  { label: "Obligations", to: routePaths.obligations, icon: ListChecks },
];

function Sidebar({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { session } = useAuthSession();

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Lexbridge Legal
        </p>
        <div className="mt-1 text-xl font-semibold">Contract Tracker</div>
      </div>
      <nav aria-label="Primary navigation" className="space-y-1">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cx(
                "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition focus-visible:shadow-focus",
                isActive ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-surface",
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
      <div className="mt-6 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-start gap-2 text-sm">
          <Bell aria-hidden className="mt-0.5 text-amber-700" size={16} />
          <div>
            <p className="font-medium">Processing visibility</p>
            <p className="mt-1 text-xs text-muted">Upload a PDF and monitor backend status.</p>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-border pt-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <div
            aria-hidden
            className="grid size-9 place-items-center rounded-full bg-teal-700 text-sm font-semibold text-white"
          >
            AR
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {session ? "Development Reviewer" : "No active session"}
            </p>
            <p className="truncate text-xs text-muted">
              {import.meta.env.VITE_DEV_ORGANIZATION_ID ? "Development organization" : "Set auth env headers"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-white px-4 py-5 lg:block">
        <Sidebar />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-border bg-white px-4 py-5 shadow-xl">
            <button
              aria-label="Close navigation"
              className="absolute right-3 top-3 rounded-md p-2 hover:bg-surface focus-visible:shadow-focus"
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
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                className="rounded-md p-2 hover:bg-surface focus-visible:shadow-focus lg:hidden"
                onClick={() => setMobileOpen(true)}
                type="button"
              >
                <Menu aria-hidden size={20} />
              </button>
              <div className="hidden items-center gap-2 text-sm text-muted sm:flex">
                <span>Workspace</span>
                <ChevronRight aria-hidden size={14} />
                <span className="font-medium text-ink">Contract Operations</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Notifications"
                className="relative rounded-md border border-border bg-white p-2 hover:bg-surface focus-visible:shadow-focus"
                type="button"
              >
                <Bell aria-hidden size={17} />
                <span className="absolute right-1 top-1 size-2 rounded-full bg-red-600" />
              </button>
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
