"use client";

import { Check, Radio } from "lucide-react";
import { AdminOnly } from "@/components/AdminOnly";
import { ErrorNote, LevelBadge, PageTitle, Skeleton } from "@/components/ui";
import type { Overview, Scenario } from "@/lib/api";
import { LEVEL_COLOR } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

function ScenarioCard({ id, name, description }: { id: string | null; name: string; description: string }) {
  const { city, horizon, scenario, setScenario } = useApp();
  const query = new URLSearchParams({ horizon: String(horizon) });
  if (id) query.set("scenario", id);
  const { data, error } = useApi<Overview>(`/api/cities/${city!.id}/overview?${query}`);
  const active = scenario === id;
  const atRisk = data ? data.counts.high + data.counts.critical : 0;

  return (
    <div className={`card card-hover flex flex-col p-5 ${active ? "!border-accent shadow-[0_0_28px_-10px_var(--color-accent)]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {!id && <Radio size={15} className="text-low" />}
            {name}
          </h3>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {data && <LevelBadge level={data.level} />}
      </div>

      {error && <p className="mt-4 text-sm text-critical">{error}</p>}
      {!data && !error && <Skeleton className="mt-4 h-16" />}
      {data && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">City risk</span>
            <span className="text-lg font-semibold tabular-nums">{data.score}<span className="text-xs text-muted"> / 1000</span></span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${data.score / 10}%`, background: LEVEL_COLOR[data.level] }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {atRisk} of {data.assets.length} assets at high or critical risk
          </p>
        </div>
      )}

      <button className={`btn mt-5 ${active ? "" : "btn-ghost"}`} onClick={() => setScenario(id)} disabled={active}>
        {active ? (<><Check size={15} /> Active</>) : id ? "Apply stress test" : "Return to live"}
      </button>
    </div>
  );
}

function ScenariosView() {
  const { data, error, reload } = useApi<Scenario[]>("/api/scenarios");
  return (
    <div>
      <PageTitle
        title="Scenarios"
        subtitle="Stress-test the city against extreme events. Applying one changes every admin tab until you return to live."
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ScenarioCard id={null} name="Live forecast" description="Real conditions from the current weather and river forecast." />
        {data?.map((s) => <ScenarioCard key={s.id} {...s} />)}
      </div>
    </div>
  );
}

export default function ScenariosPage() {
  return (
    <AdminOnly>
      <ScenariosView />
    </AdminOnly>
  );
}
