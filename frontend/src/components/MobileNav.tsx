"use client";

import { Bell, Flag, LayoutDashboard, ListChecks, Map, Navigation, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type TextKey, useT } from "@/lib/i18n";
import { useApp } from "@/lib/store";

type Tab = { href: string; label: string; icon: LucideIcon; tk?: TextKey; badge?: "alerts" | "pendingReports" };

const USER_TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, tk: "home" },
  { href: "/map", label: "Map", icon: Map, tk: "map" },
  { href: "/alerts", label: "Alerts", icon: Bell, tk: "alerts", badge: "alerts" },
  { href: "/route", label: "Route", icon: Navigation, tk: "route" },
  { href: "/reports", label: "Report", icon: Flag, tk: "report" },
];

const ADMIN_TABS: Tab[] = [
  { href: "/dashboard", label: "Centre", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/plan", label: "Plan", icon: ListChecks },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
  { href: "/reports", label: "Reports", icon: Flag, badge: "pendingReports" },
];

/** Bottom tab bar that replaces the sidebar on phones. */
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin, badges } = useApp();
  const t = useT();

  return (
    <nav className="no-print flex shrink-0 border-t border-line bg-side md:hidden" aria-label="Main">
      {(isAdmin ? ADMIN_TABS : USER_TABS).map((tab) => {
        const active = pathname === tab.href;
        const count = tab.badge ? badges[tab.badge] : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] ${active ? "text-accent" : "text-muted"}`}
          >
            <tab.icon size={20} />
            <span className="max-w-full truncate">{tab.tk ? t(tab.tk) : tab.label}</span>
            {count > 0 && (
              <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-critical px-1.5 text-[10px] font-bold text-white">{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
