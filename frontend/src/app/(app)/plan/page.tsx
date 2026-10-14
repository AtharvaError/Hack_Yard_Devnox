"use client";

import { ArrowRight, Check, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { Gauge } from "@/components/charts";
import { Card, Empty, ErrorNote, LevelBadge, PageTitle, Skeleton, Stat } from "@/components/ui";
import { api, type Plan, type PlanAction, type PlanEffect, type Task } from "@/lib/api";
import { HAZARD_LABEL, TYPE_LABEL, TYPE_SINGULAR, formatPeople, timeAgo } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const STATUS_LABEL: Record<Task["status"], string> = { assigned: "Assigned", in_progress: "In progress", done: "Done" };

function ActionRow({ action, task, onAssign }: { action: PlanAction; task?: Task; onAssign?: (action: PlanAction) => void }) {
  return (
    <li className="flex gap-4 rounded-xl bg-panel-2 p-4">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${action.rank ? "bg-accent text-on-accent" : "bg-panel text-muted"}`}>
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
      {onAssign &&
        (task ? (
          <span className="flex shrink-0 items-center gap-1 self-start rounded-full bg-low/15 px-2.5 py-1 text-xs font-medium text-low">
            <Check size={12} /> {STATUS_LABEL[task.status]}
          </span>
        ) : (
          <button onClick={() => onAssign(action)} className="btn btn-ghost shrink-0 self-start !px-3 !py-1.5 text-xs">
            <UserPlus size={13} /> Assign
          </button>
        ))}
    </li>
  );
}

function Side({ title, hint, picture }: { title: string; hint: string; picture: PlanEffect["before"] }) {
  return (
    <div className="rounded-xl bg-panel-2 p-4 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted">{hint}</div>
      <Gauge score={picture.score} level={picture.level} />
      <dl className="space-y-1.5 text-left text-sm">
        <div className="flex justify-between"><dt className="text-muted">Assets at high or critical risk</dt><dd className="font-semibold tabular-nums">{picture.at_risk}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Hospitals that may be cut off</dt><dd className="font-semibold tabular-nums">{picture.isolated_hospitals}</dd></div>
      </dl>
    </div>
  );
}

/** Before and after: what the city's risk would be if the actions that fit the budget were carried out. */
function WhatIf({ budget, crews, onBudget }: { budget: string; crews: string; onBudget: (value: string) => void }) {
  const { city, riskQuery } = useApp();
  const params = new URLSearchParams(riskQuery);
  if (budget) params.set("budget", budget);
  if (crews) params.set("crews", crews);
  const { data, error, reload } = useApi<PlanEffect>(`/api/cities/${city!.id}/plan/effect?${params}`);
  const [slider, setSlider] = useState<number | null>(null);

  useEffect(() => setSlider(null), [budget]);
  if (error) return <Card title="What if we act?"><ErrorNote message={error} onRetry={reload} /></Card>;
  if (!data) return <Skeleton className="h-80" />;

  const max = Math.max(data.max_cost, 1);
  const shown = slider ?? (budget ? Math.min(Number(budget), max) : max);
  const drop = data.before.score - data.after.score;
  const top = Math.max(...data.by_type.map((r) => r.removed), 1);

  return (
    <Card title="What if we act?">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Budget</span>
        <input
          type="range"
          min={0}
          max={max}
          step={Math.max(Math.round(max / 60), 1)}
          value={shown}
          onChange={(e) => setSlider(Number(e.target.value))}
          onPointerUp={() => slider !== null && onBudget(slider >= max ? "" : String(slider))}
          onKeyUp={() => slider !== null && onBudget(slider >= max ? "" : String(slider))}
          className="min-w-40 flex-1 accent-[#00e5ff]"
          aria-label="Budget in lakh rupees"
        />
        <span className="text-lg font-semibold tabular-nums">₹{Math.round(shown)} lakh</span>
        <span className="text-xs text-muted">{data.actions} actions · {data.crews} crews</span>
      </div>

      <div className="mt-4 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr_1.1fr]">
        <Side title="If nothing is done" hint="Current conditions" picture={data.before} />
        <div className="text-center">
          <ArrowRight size={28} className="mx-auto text-low" />
          <div className="text-2xl font-semibold text-low tabular-nums">{drop > 0 ? `−${drop}` : "0"}</div>
          <div className="text-xs text-muted">points of city risk</div>
        </div>
        <Side title={`After ${data.actions} action${data.actions === 1 ? "" : "s"}`} hint={`₹${Math.round(data.cost)} lakh spent`} picture={data.after} />
        <div>
          <div className="mb-2 text-sm font-semibold">Where the reduction comes from</div>
          {data.by_type.length === 0 && <p className="text-sm text-muted">Nothing fits this budget yet.</p>}
          <ul className="space-y-2">
            {data.by_type.slice(0, 5).map((row) => (
              <li key={row.type}>
                <div className="flex justify-between text-xs">
                  <span>{TYPE_LABEL[row.type]}</span>
                  <span className="text-muted tabular-nums">−{row.removed}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(100 * row.removed) / top}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        An estimate: it assumes every selected action is completed and works as planned. Risk reduction per action is a
        planning assumption.
      </p>
    </Card>
  );
}

function Tasks({ tasks, reload }: { tasks: Task[]; reload: () => void }) {
  const { notify } = useApp();
  const change = async (task: Task, body: Partial<Pick<Task, "status" | "crew">>) => {
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };
  const remove = async (task: Task) => {
    if (!window.confirm(`Remove the task for ${task.asset}?`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  return (
    <Card title={`Crew tasks (${tasks.filter((t) => t.status !== "done").length} open)`}>
      {tasks.length === 0 && <Empty>Press Assign on an action to hand it to a crew and follow its progress here.</Empty>}
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className={`flex flex-wrap items-center gap-3 rounded-xl bg-panel-2 p-3 ${task.status === "done" ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{task.asset}</div>
              <div className="truncate text-xs text-muted">{task.action}</div>
              <div className="mt-0.5 text-xs text-muted">{task.crew || "No crew named"} · updated {timeAgo(task.updated_at)}</div>
            </div>
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={task.status}
              onChange={(e) => change(task, { status: e.target.value as Task["status"] })}
              aria-label={`Status of the task for ${task.asset}`}
            >
              {(Object.keys(STATUS_LABEL) as Task["status"][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button onClick={() => remove(task)} aria-label={`Remove the task for ${task.asset}`} className="text-muted hover:text-critical">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlanView() {
  const { city, riskQuery, notify } = useApp();
  const [budget, setBudget] = useState("");
  const [crews, setCrews] = useState("");
  const [applied, setApplied] = useState({ budget: "", crews: "" });
  const [showDeferred, setShowDeferred] = useState(false);

  const params = new URLSearchParams(riskQuery);
  if (applied.budget) params.set("budget", applied.budget);
  if (applied.crews) params.set("crews", applied.crews);
  const { data, error, loading, reload } = useApi<Plan>(city ? `/api/cities/${city.id}/plan?${params}` : null);
  const tasks = useApi<Task[]>(city ? `/api/cities/${city.id}/tasks` : null);
  const openTask = (assetId: number) => tasks.data?.find((t) => t.asset_id === assetId && t.status !== "done");

  const assign = async (action: PlanAction) => {
    const crew = window.prompt(`Which crew takes "${action.action}" at ${action.asset}?`, "Crew A");
    if (crew === null) return;
    try {
      await api(`/api/cities/${city!.id}/tasks`, { body: { asset_id: action.asset_id, action: action.action, crew } });
      notify(`Assigned to ${crew || "a crew"}.`);
      tasks.reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  return (
    <div>
      <PageTitle
        title="Action Plan"
        subtitle="Preventive actions ranked by risk removed per rupee, weighted by how many other assets depend on each one."
      />
      <div className="mb-5">
        <WhatIf
          budget={applied.budget}
          crews={applied.crews}
          onBudget={(value) => {
            setBudget(value);
            setApplied((a) => ({ ...a, budget: value }));
          }}
        />
      </div>
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
          {tasks.data && <Tasks tasks={tasks.data} reload={tasks.reload} />}
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
                {data.selected.map((a) => <ActionRow key={a.asset_id} action={a} task={openTask(a.asset_id)} onAssign={assign} />)}
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
