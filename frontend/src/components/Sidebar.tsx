"use client";

import {
  Bell, FileText, Flag, GitFork, LayoutDashboard, ListChecks, LogOut, Map, Navigation,
  Server, Settings, ShieldAlert, Users, Zap, type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { timeAgo } from "@/lib/labels";
import { useApp } from "@/lib/store";

type Item = { href: string; label: string; icon: LucideIcon; badge?: "alerts" | "pendingReports" };
type Group = { title: string; items: Item[] };

const ADMIN_NAV: Group[] = [
  {
    title: "Monitor",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/map", label: "Live Map", icon: Map },
      { href: "/assets", label: "Assets", icon: Server },
    ],
  },
  {
    title: "Analyse",
    items: [
      { href: "/cascade", label: "Cascade Simulator", icon: GitFork },
      { href: "/scenarios", label: "Scenarios", icon: Zap },
      { href: "/plan", label: "Action Plan", icon: ListChecks },
    ],
  },
  {
    title: "Communicate",
    items: [
      { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
      { href: "/reports", label: "Reports", icon: Flag, badge: "pendingReports" },
      { href: "/brief", label: "AI Brief", icon: FileText },
      { href: "/route", label: "Safe Route", icon: Navigation },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const USER_NAV: Group[] = [
  {
    title: "Monitor",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/map", label: "Live Map", icon: Map },
    ],
  },
  {
    title: "Stay safe",
    items: [
      { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
      { href: "/route", label: "Safe Route", icon: Navigation },
      { href: "/brief", label: "Advisory", icon: FileText },
    ],
  },
  {
    title: "Community",
    items: [{ href: "/reports", label: "Report an Issue", icon: Flag, badge: "pendingReports" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, badges, live, city, logout } = useApp();
  const groups = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    // Fixed to the viewport height and never scrolls; only the main area scrolls.
    <aside className="no-print flex h-screen w-60 shrink-0 flex-col overflow-hidden border-r border-line bg-side px-3 py-4">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
          <ShieldAlert size={18} />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          Infra<span className="text-accent">Sentinel</span>
        </span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-3">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="px-2 pb-1 text-[11px] font-medium tracking-wider text-muted uppercase">{group.title}</div>
            <ul>
              {group.items.map((item) => {
                const active = pathname === item.href;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
                        active ? "text-white" : "text-muted hover:text-ink"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-lg bg-accent shadow-[0_0_20px_-6px_var(--color-accent)]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      {!active && (
                        <span className="absolute inset-0 rounded-lg bg-panel-2 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                      <item.icon size={16} className="relative transition-transform group-hover:scale-110" />
                      <span className="relative flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={`relative rounded-full px-1.5 text-[11px] font-semibold ${
                            active ? "bg-white/25 text-white" : "bg-accent/20 text-accent"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mb-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs [@media(max-height:760px)]:hidden">
        <div className="flex items-center gap-2 font-medium">
          <span className={`live-dot ${live ? "" : "off"}`} />
          {!live ? "Reconnecting…" : city?.data_mode === "demo" ? "Demo data in use" : "Live data connected"}
        </div>
        <div className="mt-1.5 text-muted">
          {!city
            ? "No city loaded yet"
            : city.data_mode === "demo"
              ? `Modelled storm: ${city.demo_storm}`
              : `Forecast updated ${timeAgo(city.weather_at)}`}
        </div>
      </div>

      <button
        onClick={logout}
        className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-ink"
      >
        <LogOut size={16} />
        Log out
      </button>
    </aside>
  );
}
