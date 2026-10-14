"use client";

import {
  AlertTriangle, Check, CircleHelp, EyeOff, Loader2, MapPin, RefreshCw, ShieldAlert, ShieldCheck, ShieldX, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CheckLabel, Report } from "@/lib/api";
import { capitalize, timeAgo } from "@/lib/labels";
import { SEVERITY_COLOR } from "./ReportForm";

export const STATUS_COLOR = { pending: "var(--color-moderate)", verified: "var(--color-low)", rejected: "var(--color-muted)" };
const STATUS_TEXT = { pending: "Under review", verified: "Verified", rejected: "Rejected" };

const CHECK: Record<CheckLabel, { text: string; color: string; icon: LucideIcon }> = {
  genuine: { text: "Likely genuine", color: "var(--color-low)", icon: ShieldCheck },
  review: { text: "Needs review", color: "var(--color-moderate)", icon: ShieldAlert },
  irrelevant: { text: "Likely irrelevant", color: "var(--color-critical)", icon: ShieldX },
  inappropriate: { text: "Inappropriate content", color: "var(--color-critical)", icon: EyeOff },
  unchecked: { text: "Not AI-checked", color: "var(--color-muted)", icon: CircleHelp },
  pending: { text: "Checking photos…", color: "var(--color-accent)", icon: Loader2 },
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
      {children}
    </span>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report photo"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Report photo, full size" className="max-h-full max-w-full rounded-xl" />
      <button aria-label="Close photo" className="absolute top-5 right-5 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30">
        <X size={18} />
      </button>
    </div>
  );
}

export function ReportCard({
  report,
  selected,
  onSelect,
  onOpenPhoto,
  onReview,
  onRecheck,
}: {
  report: Report;
  selected: boolean;
  onSelect: () => void;
  onOpenPhoto: (url: string) => void;
  /** Present for administrators only. */
  onReview?: (status: "verified" | "rejected") => void;
  onRecheck?: () => void;
}) {
  const check = report.check;
  const style = check ? CHECK[check.label] : null;
  // Photos the AI marked inappropriate stay blurred until an administrator chooses to look.
  const [revealed, setRevealed] = useState(false);
  const hidden = check?.label === "inappropriate" && !revealed;

  return (
    <li
      id={`report-${report.id}`}
      className={`rounded-xl border bg-panel-2 p-3 transition-colors ${selected ? "border-accent" : "border-transparent"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onSelect} className="min-w-0 text-left">
          <div className="truncate text-sm font-medium">
            <span className="text-muted">#{report.id}</span> {report.category}
          </div>
        </button>
        <div className="flex shrink-0 gap-1.5">
          <Pill color={SEVERITY_COLOR[report.severity]}>{capitalize(report.severity)}</Pill>
          <Pill color={STATUS_COLOR[report.status]}>{STATUS_TEXT[report.status]}</Pill>
        </div>
      </div>

      {report.photos.length > 0 && (
        <div className="mt-2.5 flex gap-2">
          {report.photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => (hidden ? setRevealed(true) : onOpenPhoto(photo.url))}
              aria-label={hidden ? "Show hidden photo" : `Open photo ${i + 1} of report ${report.id}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Photo ${i + 1} of report ${report.id}`}
                loading="lazy"
                className={`h-full w-full object-cover transition-transform hover:scale-105 ${hidden ? "blur-xl" : ""}`}
              />
              {hidden && <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] text-white">Show</span>}
            </button>
          ))}
        </div>
      )}

      {report.address && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-muted">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          {report.address}
        </p>
      )}
      {report.description && <p className="mt-2 text-sm">{report.description}</p>}
      <p className="mt-1.5 text-xs text-muted">
        {report.user_email ? `${report.user_email} · ` : ""}
        {timeAgo(report.created_at)}
      </p>

      {check && style && (
        <div className="mt-3 rounded-lg border border-line bg-panel p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: style.color }}>
              <style.icon size={15} className={check.label === "pending" ? "animate-spin" : ""} />
              {style.text}
              {check.confidence != null && (
                <span className="text-xs font-normal text-muted">{Math.round(check.confidence * 100)}% sure</span>
              )}
            </span>
            {onRecheck && check.label !== "pending" && (
              <button onClick={onRecheck} className="flex items-center gap-1 text-xs text-muted hover:text-ink" title="Run the photo check again">
                <RefreshCw size={12} /> Re-check
              </button>
            )}
          </div>
          {check.reason && <p className="mt-1 text-xs text-muted">{check.reason}</p>}
          {report.flags && report.flags.length > 0 && (
            <ul className="mt-2 space-y-1">
              {report.flags.map((flag) => (
                <li key={flag.code} className="flex items-start gap-1.5 text-xs text-high">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {flag.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onReview && report.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button className="btn flex-1 !py-1.5" onClick={() => onReview("verified")}>
            <Check size={14} /> Verify
          </button>
          <button className="btn btn-ghost flex-1 !py-1.5" onClick={() => onReview("rejected")}>
            <X size={14} /> Reject
          </button>
        </div>
      )}
    </li>
  );
}
