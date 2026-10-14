"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

/** Sun and moon switch between the light and dark themes. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const light = theme === "light";
  return (
    <button
      onClick={() => setTheme(light ? "dark" : "light")}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-bg/60 text-muted transition-colors hover:border-accent/60 hover:text-accent ${className}`}
    >
      <Sun size={16} className={`absolute transition-all duration-300 ${light ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`} />
      <Moon size={16} className={`absolute transition-all duration-300 ${light ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`} />
    </button>
  );
}
