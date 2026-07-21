import { FileText, Gauge, ListChecks, Upload, UserCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { routePaths } from "../../app/route-paths.js";
import { cx } from "../../utils/cx.js";

const navigation = [
  { label: "Contracts", to: routePaths.contracts, icon: FileText },
  { label: "Upload", to: routePaths.contractUpload, icon: Upload },
  { label: "Reviews", to: routePaths.reviews, icon: UserCheck },
  { label: "Obligations", to: routePaths.obligations, icon: ListChecks },
  { label: "KPIs", to: routePaths.kpis, icon: Gauge },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white px-4 py-5 lg:block">
        <div className="mb-8">
          <p className="text-sm font-semibold text-muted">Contract & Obligation</p>
          <h1 className="text-xl font-semibold">Tracker</h1>
        </div>
        <nav aria-label="Primary navigation" className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cx(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  isActive ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-surface",
                )
              }
              key={item.to}
              to={item.to}
            >
              <item.icon aria-hidden size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  cx(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                    isActive ? "bg-teal-50 text-teal-800" : "text-slate-700",
                  )
                }
                key={item.to}
                to={item.to}
              >
                <item.icon aria-hidden size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
