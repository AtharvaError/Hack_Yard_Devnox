"use client";

import { Bell, Loader2, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type Place } from "@/lib/api";
import { HORIZONS } from "@/lib/labels";
import { useApp } from "@/lib/store";

export function CitySearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const { cities, selectCity, loadCity, loadingCity } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api<Place[]>(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (place: Place) => {
    setOpen(false);
    setQuery("");
    loadCity(place);
  };

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        className="input !rounded-full !pl-10"
        placeholder="Search any city…"
        aria-label="Search any city"
        value={query}
        autoFocus={autoFocus}
        disabled={!!loadingCity}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {searching && <Loader2 size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-muted" />}
      {open && (results.length > 0 || (query.length < 2 && cities.length > 0)) && (
        <ul className="card absolute top-full z-40 mt-2 max-h-80 w-full overflow-auto p-1.5 shadow-2xl">
          {query.length < 2 && <li className="px-3 py-1.5 text-[11px] tracking-wider text-muted uppercase">Loaded cities</li>}
          {query.length < 2
            ? cities.map((c) => (
                <li key={c.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2"
                    onClick={() => {
                      selectCity(c);
                      setOpen(false);
                    }}
                  >
                    <MapPin size={14} className="text-accent" />
                    {c.name}
                    <span className="text-muted">{c.country}</span>
                  </button>
                </li>
              ))
            : results.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2"
                    onClick={() => pick(p)}
                  >
                    <MapPin size={14} className="shrink-0 text-accent" />
                    <span className="truncate">
                      {p.name}
                      <span className="text-muted"> · {[p.admin1, p.country].filter(Boolean).join(", ")}</span>
                    </span>
                  </button>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}

export function Topbar() {
  const { user, isAdmin, city, horizon, setHorizon, scenario, setScenario, badges } = useApp();

  return (
    <header className="no-print flex h-16 shrink-0 items-center gap-4 border-b border-line px-6">
      <div className="hidden min-w-0 shrink-0 lg:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          Welcome, {user.name}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              isAdmin ? "bg-accent/20 text-accent" : "bg-low/15 text-low"
            }`}
          >
            {isAdmin ? "Administrator" : "User"}
          </span>
        </div>
        <div className="truncate text-xs text-muted">
          {city ? `${city.name}${city.admin1 ? `, ${city.admin1}` : ""}, ${city.country}` : "Pick a city to begin"}
        </div>
      </div>

      <div className="flex flex-1 justify-center">
        <CitySearch />
      </div>

      {scenario && isAdmin && (
        <button
          onClick={() => setScenario(null)}
          className="flex items-center gap-1.5 rounded-full border border-high/50 bg-high/10 px-3 py-1.5 text-xs font-medium text-high"
          title="Stress test is active. Click to return to the live forecast."
        >
          Stress test on <X size={13} />
        </button>
      )}

      <div className="flex shrink-0 rounded-full border border-line bg-panel p-0.5" role="group" aria-label="Forecast time">
        {HORIZONS.map((h) => (
          <button
            key={h.value}
            onClick={() => setHorizon(h.value)}
            aria-pressed={horizon === h.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              horizon === h.value ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <Link
        href="/alerts"
        aria-label={`Alerts (${badges.alerts})`}
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-panel text-muted transition-colors hover:text-ink"
      >
        <Bell size={16} />
        {badges.alerts > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
            {badges.alerts}
          </span>
        )}
      </Link>
    </header>
  );
}
