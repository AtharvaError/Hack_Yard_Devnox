"use client";

import { Bell, FlaskConical, History, Languages, Loader2, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type City, type Place } from "@/lib/api";
import { LogoMark } from "@/components/Logo";
import { LANGS, useLang } from "@/lib/i18n";
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
        <ul className="card absolute top-full z-40 mt-2 max-h-80 w-full overflow-auto !bg-panel/95 p-1.5 shadow-2xl">
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

/** Says when scores come from the demo dataset, and lets an administrator switch to the live forecast and back. */
function DataModePill() {
  const { city, isAdmin, selectCity, notify } = useApp();
  const [busy, setBusy] = useState(false);
  if (city?.data_mode === "replay") {
    const back = async () => {
      setBusy(true);
      try {
        selectCity(await api<City>(`/api/cities/${city.id}/data-mode`, { body: { mode: city.demo_storm ? "demo" : "live" } }));
        notify("Replay ended.");
      } catch (err) {
        notify((err as Error).message, "error");
      } finally {
        setBusy(false);
      }
    };
    const look = "flex shrink-0 items-center gap-1.5 rounded-full border border-moderate/50 bg-moderate/10 px-3 py-1.5 text-xs font-medium text-moderate";
    const text = <><History size={13} /> Replay of {city.replay_date}</>;
    return isAdmin ? (
      <button onClick={back} disabled={busy} className={look} title="Scores use the weather recorded on this past date. Click to end the replay.">
        {text} <X size={13} />
      </button>
    ) : (
      <span className={look} title="Scores use the weather recorded on this past date, not today's.">{text}</span>
    );
  }
  if (!city?.demo_storm) return null;
  const demo = city.data_mode === "demo";
  if (!demo && !isAdmin) return null;

  const tone = demo ? "border-moderate/50 bg-moderate/10 text-moderate" : "border-line bg-bg/60 text-muted hover:text-ink";
  const shape = "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium";
  const label = demo ? "Demo data" : "Use demo data";
  if (!isAdmin) {
    return (
      <span className={`${shape} ${tone}`} title={`Scores use a modelled storm (${city.demo_storm}), not today's weather.`}>
        <FlaskConical size={13} /> {label}
      </span>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const mode = demo ? "live" : "demo";
      selectCity(await api<City>(`/api/cities/${city.id}/data-mode`, { body: { mode } }));
      notify(mode === "demo" ? `Showing the demo storm: ${city.demo_storm}.` : "Showing the live forecast.");
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`${shape} ${tone}`}
      title={
        demo
          ? `Scores use a modelled storm (${city.demo_storm}), not today's weather. Click to switch to the live forecast.`
          : `Scores use the live forecast. Click to show the modelled storm (${city.demo_storm}).`
      }
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} {label}
      {demo && <X size={13} />}
    </button>
  );
}

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <label className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-bg/60 px-2 py-1 text-xs text-muted" title="Language of the citizen screens">
      <Languages size={14} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
        aria-label="Language"
        className="bg-transparent text-ink outline-none"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="bg-panel">
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Topbar() {
  const { isAdmin, city, horizon, setHorizon, scenario, setScenario, badges } = useApp();

  return (
    <header className="no-print card relative z-30 m-3 mb-0 flex min-h-16 shrink-0 flex-wrap items-center gap-2 !rounded-2xl px-3 py-2.5 md:flex-nowrap md:gap-4 md:px-5 md:py-0">
      <Link href="/dashboard" aria-label="InfraSentinel home" className="mr-auto md:hidden">
        <LogoMark size={32} decorative />
      </Link>
      <div className="hidden max-w-64 min-w-0 shrink-0 lg:block">
        <div className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">{isAdmin ? "Watching" : "Your city"}</div>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display flex shrink-0 items-center gap-1.5 text-base font-bold">
            <MapPin size={15} className="self-center text-accent drop-shadow-[0_0_6px_var(--color-accent)]" />
            {city ? city.name : "No city yet"}
          </span>
          <span className="truncate text-xs text-muted">{city ? [city.admin1, city.country].filter(Boolean).join(", ") : "Pick a city to begin"}</span>
        </div>
      </div>

      <div className="order-last flex basis-full justify-center md:order-none md:flex-1 md:basis-auto">
        <CitySearch />
      </div>

      <DataModePill />

      {scenario && isAdmin && (
        <button
          onClick={() => setScenario(null)}
          className="flex items-center gap-1.5 rounded-full border border-high/50 bg-high/10 px-3 py-1.5 text-xs font-medium text-high"
          title="Stress test is active. Click to return to the live forecast."
        >
          Stress test on <X size={13} />
        </button>
      )}

      <LangSwitch />

      <div className="hidden shrink-0 rounded-full border border-line bg-bg/60 p-0.5 sm:flex" role="group" aria-label="Forecast time">
        {HORIZONS.map((h) => (
          <button
            key={h.value}
            onClick={() => setHorizon(h.value)}
            aria-pressed={horizon === h.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              horizon === h.value ? "bg-accent text-on-accent shadow-[0_0_16px_-4px_var(--color-accent)]" : "text-muted hover:text-ink"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <Link
        href="/alerts"
        aria-label={`Alerts (${badges.alerts})`}
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-bg/60 text-muted transition-colors hover:border-accent/60 hover:text-accent"
      >
        <Bell size={16} />
        {badges.alerts > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-white shadow-[0_0_10px_var(--color-critical)]">
            {badges.alerts}
          </span>
        )}
      </Link>
    </header>
  );
}
