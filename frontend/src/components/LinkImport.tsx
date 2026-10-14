"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Card } from "./ui";

type Result = { added: number; skipped: number; problems: string[] };

/** Replaces the estimated links between assets with real ones from a CSV file of city records. */
export function LinkImport({ onDone }: { onDone: () => void }) {
  const { city, notify } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const download = async () => {
    try {
      const res = await fetch(`/api/cities/${city!.id}/links/export`, { credentials: "include" });
      if (!res.ok) throw new Error("The current links could not be downloaded.");
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${city!.name.toLowerCase()}-links.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  const upload = async (file: File) => {
    if (replace && !window.confirm(`Replace every link in ${city!.name} with the ones in this file? The estimated links will be removed.`)) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("replace", String(replace));
      const done = await api<Result>(`/api/cities/${city!.id}/links/import`, { body });
      setResult(done);
      notify(`${done.added} link${done.added === 1 ? "" : "s"} added.`);
      onDone();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card title="Import real links between assets">
      <p className="text-sm text-muted">
        Links are estimated from distance until real ones are imported. Upload a CSV with the columns{" "}
        <code className="rounded bg-panel-2 px-1.5 py-0.5 text-xs text-ink">source,target,kind</code>: the target relies
        on the source for <strong className="text-ink">power</strong>, <strong className="text-ink">water</strong> or
        road <strong className="text-ink">access</strong>. Names must match the asset names in {city!.name}.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" onClick={download}>
          <Download size={14} /> Download current links
        </button>
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload CSV
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace all existing links
        </label>
      </div>
      {result && (
        <div className="mt-4 rounded-xl bg-panel-2 p-3 text-sm">
          <strong>{result.added}</strong> added, <strong>{result.skipped}</strong> skipped.
          {result.problems.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
              {result.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
