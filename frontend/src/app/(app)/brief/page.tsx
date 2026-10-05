"use client";

import { Copy, Printer, RefreshCw, Sparkles } from "lucide-react";
import { ErrorNote, PageTitle, Skeleton } from "@/components/ui";
import { useApi, useApp } from "@/lib/store";

type Brief = { text: string; source: "gemini" | "template"; generated_at: string; city: string };

export default function BriefPage() {
  const { city, isAdmin, riskQuery, notify } = useApp();
  const { data, error, loading, reload } = useApi<Brief>(city ? `/api/cities/${city.id}/brief?${riskQuery}` : null);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.text);
    notify("Brief copied to the clipboard.");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print">
        <PageTitle
          title={isAdmin ? "AI Situation Brief" : "Public Advisory"}
          subtitle={
            isAdmin
              ? "A plain-language summary for decision-makers, built from the current scores and action plan."
              : `What the current conditions mean for people in ${city!.name}.`
          }
          action={
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={reload} disabled={loading}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Regenerate
              </button>
              <button className="btn btn-ghost" onClick={copy} disabled={!data}>
                <Copy size={14} /> Copy
              </button>
              <button className="btn" onClick={() => window.print()} disabled={!data}>
                <Printer size={14} /> Save as PDF
              </button>
            </div>
          }
        />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-96" />}
      {data && (
        <article className="card print-area p-7">
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{data.text}</pre>
          <footer className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
            <Sparkles size={13} className="text-accent" />
            {data.source === "gemini" ? "Written by Gemini from the figures above" : "Generated from the built-in template"}
            {" · "}
            {new Date(data.generated_at).toLocaleString()}
          </footer>
        </article>
      )}
    </div>
  );
}
