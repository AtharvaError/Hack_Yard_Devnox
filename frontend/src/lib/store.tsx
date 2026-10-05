"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type Alert, type City, type Place, type Report, type User } from "./api";

type Toast = { id: number; text: string; tone: "info" | "error" };

type AppState = {
  user: User;
  isAdmin: boolean;
  logout: () => Promise<void>;
  city: City | null;
  cities: City[];
  selectCity: (city: City) => void;
  loadCity: (place: Place) => Promise<void>;
  loadingCity: string | null;
  horizon: number;
  setHorizon: (h: number) => void;
  scenario: string | null;
  setScenario: (s: string | null) => void;
  /** Query string carrying the time horizon and active stress test. */
  riskQuery: string;
  /** Increases whenever the server says data changed; hooks refetch on it. */
  liveVersion: number;
  live: boolean;
  badges: { alerts: number; pendingReports: number };
  notify: (text: string, tone?: Toast["tone"]) => void;
};

const AppContext = createContext<AppState | null>(null);
const CITY_KEY = "hackyard.city";

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const isAdmin = user.role === "admin";
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [loadingCity, setLoadingCity] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(0);
  const [scenario, setScenario] = useState<string | null>(null);
  const [liveVersion, setLiveVersion] = useState(0);
  const [live, setLive] = useState(false);
  const [badges, setBadges] = useState({ alerts: 0, pendingReports: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((list) => [...list, { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  const selectCity = useCallback((next: City) => {
    setCity(next);
    try {
      localStorage.setItem(CITY_KEY, String(next.id));
    } catch {}
  }, []);

  useEffect(() => {
    api<City[]>("/api/cities")
      .then((list) => {
        setCities(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(CITY_KEY);
        } catch {}
        setCity(list.find((c) => String(c.id) === saved) ?? list[0] ?? null);
      })
      .catch(() => {});
  }, []);

  const loadCity = useCallback(
    async (place: Place) => {
      setLoadingCity(place.name);
      try {
        const loaded = await api<City>("/api/cities/load", { body: place });
        setCities((list) => [loaded, ...list.filter((c) => c.id !== loaded.id)]);
        selectCity(loaded);
      } catch (err) {
        notify((err as Error).message, "error");
      } finally {
        setLoadingCity(null);
      }
    },
    [notify, selectCity],
  );

  // Live channel: the server only says "something changed"; data comes through the authenticated API.
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(`ws://${window.location.hostname}:8000/ws/live`);
      socket.onopen = () => setLive(true);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setLiveVersion((v) => v + 1);
        if (message.type === "alert") notify(`New ${message.severity}: ${message.title}`);
      };
      socket.onclose = () => {
        setLive(false);
        if (!closed) retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [notify]);

  useEffect(() => {
    if (!city) return;
    Promise.all([
      api<Alert[]>(`/api/alerts?city_id=${city.id}`),
      api<Report[]>(`/api/reports?city_id=${city.id}`),
    ])
      .then(([alerts, reports]) =>
        setBadges({ alerts: alerts.length, pendingReports: reports.filter((r) => r.status === "pending").length }),
      )
      .catch(() => {});
  }, [city, liveVersion]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }, []);

  const riskQuery = useMemo(() => {
    const params = new URLSearchParams({ horizon: String(horizon) });
    if (scenario && isAdmin) params.set("scenario", scenario);
    return params.toString();
  }, [horizon, scenario, isAdmin]);

  const value: AppState = {
    user, isAdmin, logout, city, cities, selectCity, loadCity, loadingCity,
    horizon, setHorizon, scenario, setScenario, riskQuery, liveVersion, live, badges, notify,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`card pointer-events-auto max-w-sm px-4 py-3 text-sm shadow-xl ${
              t.tone === "error" ? "border-critical/60 text-critical" : "border-accent/60"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

/** Fetches `path` and refetches when it changes, when the server pushes an update, or on `reload()`. */
export function useApi<T>(path: string | null) {
  const { liveVersion } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    api<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, liveVersion, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
