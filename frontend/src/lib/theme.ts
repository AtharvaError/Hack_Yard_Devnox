"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Light and dark themes. The choice lives on <html data-theme="..."> (set before first paint by a
 * small script in the root layout) and in localStorage, so every screen and every reload agrees.
 */

export type Theme = "dark" | "light";

/** Also read by the inline script in app/layout.tsx. */
export const THEME_KEY = "infrasentinel.theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function current(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "dark");
}

export function setTheme(theme: Theme) {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

/** Turns "var(--color-low)" into the colour it currently stands for; other colours pass through. */
export function resolveColor(color: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(color);
  if (!match || typeof document === "undefined") return color;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color;
}

/**
 * For places that need a real colour value rather than a CSS variable (the map canvas, chart SVG).
 * The returned function changes with the theme, so anything depending on it redraws.
 */
export function useColor(): (color: string) => string {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((color: string) => resolveColor(color), [theme]);
}

/** A colour at the given opacity (0-100), for colours that may be CSS variables. */
export function alpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
