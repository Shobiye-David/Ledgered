import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function DashboardShell({ eyebrow, title, subtitle, actions, navItems, children }) {
  const location = useLocation();
  const { user } = useAuth();
  const roleLinks = user?.role === "platform_admin"
    ? [{ to: "/admin/audit", label: "Audit log" }]
    : user?.role === "institution_staff" && user?.activeMembership?.isAdmin === true
      ? [{ to: "/institution/activity", label: "Activity" }]
      : [];
  const visibleNavItems = navItems ? [...navItems, ...roleLinks.filter((link) => !navItems.some((item) => item.to === link.to))] : navItems;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 md:flex-row md:gap-10">
      {visibleNavItems && (
        <aside className="w-full shrink-0 md:w-48">
          {/* Horizontal scrollable pills on mobile, vertical stacked list from md up */}
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 md:sticky md:top-6 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
            {visibleNavItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block shrink-0 whitespace-nowrap rounded px-3 py-2 text-sm transition-colors ${
                    active ? "bg-pine text-paper" : "text-ink-muted hover:bg-paper-raised hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-sm font-medium text-amber">{eyebrow}</p>}
            <h1 className="mt-1 break-words text-xl text-ink sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1 break-words text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex w-full shrink-0 flex-wrap gap-3 sm:w-auto">{actions}</div>}
        </div>

        <div className="mt-6 sm:mt-8">{children}</div>
      </div>
    </div>
  );
}
