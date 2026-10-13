"use client";

import { History, Loader2 } from "lucide-react";
import { useState } from "react";
import { api, type City } from "@/lib/api";
import { useApp } from "@/lib/store";

/** Scores the city against the weather recorded on a past date, from Open-Meteo's free archive. */
export function ReplayCard() {
  const { city, selectCity, notify } = useApp();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const replaying = city!.data_mode === "replay";
  const latest = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

  const run = async (mode: "replay" | "back") => {
    setBusy(true);
    try {
      const body = mode === "replay" ? { mode: "replay", date } : { mode: city!.demo_storm ? "demo" : "live" };
      selectCity(await api<City>(`/api/cities/${city!.id}/data-mode`, { body }));
      notify(mode === "replay" ? `Showing ${city!.name} with the weather recorded on ${date}.` : "Replay ended.");
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card flex flex-col p-5 ${replaying ? "!border-moderate" : ""}`}>
      <h3 className="flex items-center gap-2 font-semibold">
        <History size={15} className="text-accent" /> Replay a past date
      </h3>
      <p className="mt-1 text-sm text-muted">
        Score {city!.name} against the rain, wind, heat and river flow recorded on a past date, for example the day of a
        known flood. Useful for checking whether the scores point at the places that were actually hit.
      </p>
      <input
        type="date"
        className="input mt-4"
        min="1984-01-01"
        max={latest}
        value={replaying ? city!.replay_date ?? "" : date}
        disabled={replaying}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date to replay"
      />
      <p className="mt-2 text-xs text-muted">
        Recorded weather is real; today&apos;s assets and estimated links are used, so this is a check, not a
        reconstruction of the event.
      </p>
      {replaying ? (
        <button className="btn btn-ghost mt-4" onClick={() => run("back")} disabled={busy}>
          {busy && <Loader2 size={14} className="animate-spin" />} End the replay
        </button>
      ) : (
        <button className="btn mt-4" onClick={() => run("replay")} disabled={busy || !date}>
          {busy && <Loader2 size={14} className="animate-spin" />} Replay this date
        </button>
      )}
    </div>
  );
}
