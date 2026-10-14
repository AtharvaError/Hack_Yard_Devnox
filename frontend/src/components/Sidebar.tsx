"use client";

import {
  Bell, FileText, Flag, GitFork, LayoutDashboard, ListChecks, LogOut, Map, Navigation,
  Server, Settings, Users, Zap, type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { type TextKey, useT } from "@/lib/i18n";
import { timeAgo } from "@/lib/labels";
import { useApp } from "@/lib/store";

type Item = { href: string; label: string; icon: LucideIcon; badge?: "alerts" | "pendingReports"; tk?: TextKey };
type Group = { title: string; items: Item[] };

const ADMIN_NAV: Group[] = [
  {
    title: "Monitor",
    items: [
      { href: "/dashboard", label: "Command Centre", icon: LayoutDashboard },
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
      { href: "/dashboard", label: "Home", icon: LayoutDashboard, tk: "home" },
      { href: "/map", label: "Live Map", icon: Map, tk: "map" },
    ],
  },
  {
    title: "Stay safe",
    items: [
      { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts", tk: "alerts" },
      { href: "/route", label: "Safe Route", icon: Navigation, tk: "route" },
      { href: "/brief", label: "Advisory", icon: FileText, tk: "advisory" },
    ],
  },
  {
    title: "Community",
    items: [{ href: "/reports", label: "Report an Issue", icon: Flag, badge: "pendingReports", tk: "report" }],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, badges, live, city, logout } = useApp();
  const groups = isAdmin ? ADMIN_NAV : USER_NAV;
  const t = useT();

  const status = !live
    ? { title: "Reconnecting…", detail: "Trying the server again" }
    : city?.data_mode === "demo"
      ? { title: "Demo data in use", detail: `Modelled storm: ${city.demo_storm}` }
      : city?.data_mode === "replay"
        ? { title: "Replaying a past date", detail: `Recorded weather of ${city.replay_date}` }
        : { title: "Live data connected", detail: city ? `Forecast updated ${timeAgo(city.weather_at)}` : "No city loaded yet" };

  return (
    // Fixed to the viewport height and never scrolls; only the main area scrolls.
    <aside className="no-print hidden h-screen w-64 shrink-0 p-3 pr-0 md:flex">
      <div className="card flex w-full flex-col overflow-hidden !rounded-3xl px-3 py-4">
        <Link href="/dashboard" className="mb-5 px-2 pt-1" aria-label="InfraSentinel home">
          <Logo size={36} textClass="text-[19px]" />
        </Link>

        <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-muted/70 uppercase">{group.title}</div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const count = item.badge ? badges[item.badge] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-colors ${
                          active ? "font-medium text-ink" : "text-muted hover:text-ink"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-pill"
                            className="absolute inset-0 rounded-xl border border-accent/35 bg-gradient-to-r from-accent/20 via-accent-2/10 to-transparent shadow-[0_0_24px_-10px_var(--color-accent)]"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          >
                            <span className="absolute top-1.5 bottom-1.5 -left-px w-[3px] rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
                          </motion.span>
                        )}
                        {!active && (
                          <span className="absolute inset-0 rounded-xl bg-white/[0.04] opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                        <item.icon
                          size={17}
                          className={`relative transition-transform group-hover:scale-110 ${active ? "text-accent drop-shadow-[0_0_6px_var(--color-accent)]" : ""}`}
                        />
                        <span className="relative flex-1 truncate">{item.tk ? t(item.tk) : item.label}</span>
                        {count > 0 && (
                          <span className="relative rounded-full bg-accent-3/20 px-1.5 text-[11px] font-bold text-accent-3 shadow-[0_0_10px_-3px_var(--color-accent-3)]">
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

        <div className="mt-3 mb-3 rounded-2xl border border-low/25 bg-gradient-to-br from-low/10 to-transparent p-3 text-xs [@media(max-height:760px)]:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <span className={`live-dot ${live ? "" : "off"}`} />
            {status.title}
          </div>
          <div className="mt-1.5 text-muted">{status.detail}</div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-white/[0.03] p-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-3 text-xs font-bold text-on-accent">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className={`text-[10px] font-semibold tracking-wider uppercase ${isAdmin ? "text-accent" : "text-low"}`}>
              {isAdmin ? "Administrator" : "Citizen"}
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-critical/15 hover:text-critical"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
