"use client";

import { AlertTriangle, Clock, Hospital, Loader2, LocateFixed, Navigation, Ruler } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskMap, assetPoint } from "@/components/RiskMap";
import { Card, PageTitle, Stat } from "@/components/ui";
import { api, type Overview, type RouteResult } from "@/lib/api";
import { useApi, useApp } from "@/lib/store";

export default function RoutePage() {
  const { city, notify } = useApp();
  // Routing always uses current conditions, whatever time is selected in the top bar.
  const { data } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?horizon=0` : null);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState(false);

  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);
  const points = useMemo(
    () =>
      (data?.assets ?? [])
        .filter((a) => a.type === "hospital" || a.type === "road" || a.type === "bridge")
        .map((a) => assetPoint(a, a.id === result?.hospital.id)),
    [data, result],
  );

  const place = (lon: number, lat: number) => {
    setPin([lon, lat]);
    setResult(null);
  };

  const locate = () => {
    if (!navigator.geolocation) return notify("Your browser does not share location. Click the map instead.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => place(pos.coords.longitude, pos.coords.latitude),
      () => notify("Could not get your location. Click the map instead.", "error"),
    );
  };

  const find = async () => {
    if (!pin) return;
    setBusy(true);
    try {
      setResult(await api<RouteResult>(`/api/cities/${city!.id}/route?lat=${pin[1]}&lon=${pin[0]}`));
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Safe Route"
        subtitle="Find a driving route to the nearest hospital that is not at risk, avoiding roads and bridges in danger."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="card p-2">
          <RiskMap
            center={center}
            points={points}
            pin={pin}
            route={result?.geometry ?? null}
            onMapClick={(lat, lon) => place(lon, lat)}
            className="h-[calc(100vh-230px)] min-h-[420px]"
          />
        </div>

        <div className="space-y-5">
          <Card title="Where are you?">
            <p className="text-sm text-muted">
              {pin ? `Start point: ${pin[1].toFixed(4)}, ${pin[0].toFixed(4)}` : "Click the map to set your start point."}
            </p>
            <div className="mt-4 space-y-2">
              <button className="btn btn-ghost w-full" onClick={locate}>
                <LocateFixed size={15} /> Use my location
              </button>
              <button className="btn w-full" onClick={find} disabled={!pin || busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
                Find safe route
              </button>
            </div>
          </Card>

          {result && (
            <Card title="Your route">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                  <Hospital size={17} />
                </span>
                <div>
                  <div className="font-medium">{result.hospital.name}</div>
                  <div className={`text-xs ${result.hospital_status === "safe" ? "text-low" : "text-high"}`}>
                    {result.hospital_status === "safe" ? "Not at risk right now" : "At risk, but no safer hospital is mapped"}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Distance" value={<span className="flex items-center gap-1.5"><Ruler size={16} className="text-muted" />{result.distance_km} km</span>} />
                <Stat label="Drive time" value={<span className="flex items-center gap-1.5"><Clock size={16} className="text-muted" />{result.minutes} min</span>} />
              </div>
              {result.skipped_nearest && (
                <p className="mt-4 text-sm text-muted">
                  The nearest hospital, {result.skipped_nearest}, is at risk, so this route goes to the next safe one.
                </p>
              )}
              {result.hazards.length > 0 ? (
                <div className="mt-4 rounded-xl border border-high/40 bg-high/10 p-3 text-sm text-high">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle size={15} /> This route passes {result.hazards.length} at-risk point{result.hazards.length > 1 ? "s" : ""}
                  </div>
                  <ul className="mt-1.5 list-inside list-disc text-xs">
                    {result.hazards.map((h) => <li key={h.id}>{h.name}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-sm text-low">No at-risk roads or bridges on this route.</p>
              )}
              <p className="mt-3 text-xs text-muted">
                {result.alternatives_checked} route{result.alternatives_checked > 1 ? "s" : ""} compared. Routing by the
                public OSRM service; always follow official instructions on the ground.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
