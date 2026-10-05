"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { Card, Empty, ErrorNote, LevelBadge, PageTitle, Skeleton, Stat } from "@/components/ui";
import type { Plan, PlanAction } from "@/lib/api";
import { HAZARD_LABEL, TYPE_SINGULAR, formatPeople } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

function ActionRow({ action }: { action: PlanAction }) {
  return (
    <li className="flex gap-4 rounded-xl bg-panel-2 p-4">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${action.rank ? "bg-accent text-white" : "bg-panel text-muted"}`}>
        {action.rank ?? "–"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{action.asset}</span>
          <span className="text-xs text-muted">{TYPE_SINGULAR[action.type]} · {HAZARD_LABEL[action.hazard]}</span>
          <LevelBadge level={action.level} />
        </div>
        <p className="mt-1 text-sm">{action.action}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1 tabular-nums">
            Risk {Math.round(action.score)} <ArrowRight size={12} /> <span className="text-low">{Math.round(action.risk_after)}</span>
          </span>
          <span>₹{action.cost} lakh</span>
          <span>{action.crews} crew{action.crews > 1 ? "s" : ""}</span>
          {action.dependents > 0 && <span>{action.dependents} assets depend on it</span>}
          {action.deferred_because && <span className="text-high">Deferred: over {action.deferred_because}</span>}
        </div>
      </div>
    </li>
  );
}

function PlanView() {
  const { city, riskQuery } = useApp();
  const [budget, setBudget] = useState("");
  const [crews, setCrews] = useState("");
  const [applied, setApplied] = useState({ budget: "", crews: "" });
  const [showDeferred, setShowDeferred] = useState(false);

  const params = new URLSearchParams(riskQuery);
  if (applied.budget) params.set("budget", applied.budget);
  if (applied.crews) params.set("crews", applied.crews);
  const { data, error, loading, reload } = useApi<Plan>(city ? `/api/cities/${city.id}/plan?${params}` : null);

  return (
    <div>
      <PageTitle
        title="Action Plan"
        subtitle="Preventive actions ranked by risk removed per rupee, weighted by how many other assets depend on each one."
      />
      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <div className="space-y-5">
          <Card title="Constraints">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setApplied({ budget, crews });
              }}
            >
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Budget (₹ lakh)</span>
                <input className="input" type="number" min={0} placeholder="No limit" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Crews available</span>
                <input className="input" type="number" min={0} placeholder="No limit" value={crews} onChange={(e) => setCrews(e.target.value)} />
              </label>
              <button className="btn w-full">Prioritise</button>
            </form>
            <p className="mt-3 text-xs text-muted">Costs and crew numbers are planning assumptions, not quotations.</p>
          </Card>
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Actions" value={data.totals.actions} />
              <Stat label="Cost" value={`₹${data.totals.cost}L`} />
              <Stat label="Crews" value={data.totals.crews} />
              <Stat label="Benefit captured" value={`${data.totals.benefit_share}%`} hint="Of all possible actions" />
              {data.totals.people > 0 && (
                <div className="col-span-2">
                  <Stat label="People served by protected assets" value={formatPeople(data.totals.people)} hint="Estimate" />
                </div>
              )}
            </div>
          )}
        </div>

        <Card title="Do these first">
          {error && <ErrorNote message={error} onRetry={reload} />}
          {!data && loading && <Skeleton className="h-80" />}
          {data && data.selected.length === 0 && (
            <Empty>
              {data.deferred.length
                ? "Nothing fits these limits. Raise the budget or crew count."
                : "No asset is at meaningful risk in this period, so no action is needed. Try a later time or a stress test."}
            </Empty>
          )}
          {data && (
            <>
              <ul className="space-y-3">
                {data.selected.map((a) => <ActionRow key={a.asset_id} action={a} />)}
              </ul>
              {data.deferred.length > 0 && (
                <div className="mt-5">
                  <button className="text-sm text-accent hover:underline" onClick={() => setShowDeferred((s) => !s)}>
                    {showDeferred ? "Hide" : "Show"} {data.deferred.length} deferred action{data.deferred.length > 1 ? "s" : ""}
                  </button>
                  {showDeferred && (
                    <ul className="mt-3 space-y-3 opacity-80">
                      {data.deferred.map((a) => <ActionRow key={a.asset_id} action={a} />)}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <AdminOnly>
      <PlanView />
    </AdminOnly>
  );
}
