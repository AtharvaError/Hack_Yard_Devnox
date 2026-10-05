"use client";

import { Loader2, Play, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { RiskMap, assetPoint, type MapPoint } from "@/components/RiskMap";
import { Card, Empty, ErrorNote, PageTitle, Stat } from "@/components/ui";
import { api, type CascadeResult, type Overview } from "@/lib/api";
import { TYPE_SINGULAR, capitalize, formatPeople } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const STATUS_COLOR: Record<string, string> = {
  failed: "#f43f5e",
  isolated: "#f43f5e",
  "on backup power": "#fb923c",
  degraded: "#fb923c",
  "access reduced": "#fbbf24",
};
const UNAFFECTED = "#3b4063";

function CascadeView() {
  const { city, riskQuery, horizon, scenario, notify } = useApp();
  const { data, error, reload } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?${riskQuery}` : null);
  const [failed, setFailed] = useState<number[]>([]);
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  // Reveal the cascade one wave at a time.
  useEffect(() => {
    if (!result || step >= result.waves) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 1100);
    return () => clearTimeout(timer);
  }, [result, step]);

  const visible = useMemo(() => result?.impacted.filter((i) => i.wave <= step) ?? [], [result, step]);
  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);

  const points = useMemo<MapPoint[]>(() => {
    const assets = data?.assets ?? [];
    if (!result) return assets.map((a) => assetPoint(a, failed.includes(a.id)));
    const status = new Map(visible.map((i) => [i.id, i]));
    return assets.map((a) => {
      const hit = status.get(a.id);
      return {
        id: a.id,
        name: a.name,
        lat: a.lat,
        lon: a.lon,
        color: hit ? STATUS_COLOR[hit.status] ?? "#fb923c" : UNAFFECTED,
        label: hit ? `${TYPE_SINGULAR[a.type]} · ${capitalize(hit.status)}` : `${TYPE_SINGULAR[a.type]} · Unaffected`,
        ring: hit?.wave === 0,
      };
    });
  }, [data, result, visible, failed]);

  const toggle = (id: number) => {
    if (result) return;
    setFailed((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const run = async (auto: boolean) => {
    setRunning(true);
    try {
      const res = await api<CascadeResult>(`/api/cities/${city!.id}/cascade`, {
        body: { failed_ids: failed, auto, horizon, scenario },
      });
      if (res.summary.total === 0) notify("No asset is at critical risk right now. Pick assets on the map or switch on a stress test.");
      else {
        setResult(res);
        setStep(0);
      }
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFailed([]);
    setStep(0);
  };

  const nameOf = (id: number) => data?.assets.find((a) => a.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <PageTitle
        title="Cascade Simulator"
        subtitle="Fail one or more assets and see what else goes down. Dependency links are estimated from proximity."
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="card p-2">
          <RiskMap
            center={center}
            points={points}
            onSelect={toggle}
            links={result && step > 0 ? result.links : undefined}
            className="h-[calc(100vh-230px)] min-h-[420px]"
          />
        </div>

        <div className="space-y-5">
          {!result ? (
            <Card title="1. Choose what fails">
              {failed.length === 0 ? (
                <p className="text-sm text-muted">Click assets on the map to mark them as failed.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {failed.map((id) => (
                    <li key={id} className="flex items-center gap-1.5 rounded-full bg-critical/15 py-1 pr-2 pl-3 text-xs text-critical">
                      {nameOf(id)}
                      <button onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`}>
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 space-y-2">
                <button className="btn w-full" disabled={running || failed.length === 0} onClick={() => run(false)}>
                  {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  Run simulation
                </button>
                <button className="btn btn-ghost w-full" disabled={running} onClick={() => run(true)}>
                  Fail everything at critical risk
                </button>
              </div>
            </Card>
          ) : (
            <>
              <Card
                title="Impact"
                action={
                  <button className="btn btn-ghost !py-1.5" onClick={reset}>
                    <RotateCcw size={14} /> Reset
                  </button>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Assets affected" value={result.summary.total} />
                  <Stat label="Knock-on failures" value={result.summary.knock_on} />
                  <Stat label="Hospitals affected" value={result.summary.hospitals} />
                  <Stat label="People affected" value={formatPeople(result.summary.people)} hint="Estimate" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {Array.from({ length: result.waves + 1 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-panel-2"}`}
                      aria-label={`Show step ${i}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Step {step} of {result.waves}: {step === 0 ? "initial failures" : "knock-on effects"}
                </p>
              </Card>

              <Card title="What happens">
                {visible.length === 0 ? (
                  <Empty>Nothing affected.</Empty>
                ) : (
                  <ul className="max-h-[calc(100vh-560px)] min-h-40 space-y-2 overflow-auto pr-1">
                    {visible.map((item) => (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-xl bg-panel-2 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{item.name}</span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: STATUS_COLOR[item.status], background: `${STATUS_COLOR[item.status]}22` }}
                          >
                            {capitalize(item.status)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {TYPE_SINGULAR[item.type]} · {item.reason}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CascadePage() {
  return (
    <AdminOnly>
      <CascadeView />
    </AdminOnly>
  );
}
