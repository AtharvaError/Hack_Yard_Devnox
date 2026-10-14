"use client";

import { ImagePlus, Loader2, LocateFixed, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type ReportOptions, type Severity } from "@/lib/api";
import { capitalize } from "@/lib/labels";
import { preparePhoto, type PreparedPhoto } from "@/lib/photo";
import { useApp } from "@/lib/store";

export const SEVERITY_COLOR: Record<Severity, string> = {
  minor: "#ffd60a",
  serious: "#ff8f1f",
  dangerous: "#ff3b6b",
};

const SEVERITY_HINT: Record<Severity, string> = {
  minor: "A nuisance, still usable",
  serious: "Hard or unsafe to use",
  dangerous: "Immediate risk to people",
};

export function ReportForm({
  options,
  pin,
  onPin,
  onSubmitted,
}: {
  options: ReportOptions;
  pin: [number, number] | null; // [lon, lat]
  onPin: (pin: [number, number] | null) => void;
  onSubmitted: () => void;
}) {
  const { city, notify } = useApp();
  const [category, setCategory] = useState(options.damage_types[0]);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [address, setAddress] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Fill the address in from the map pin; the citizen can still correct it.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    setLookingUp(true);
    api<{ address: string }>(`/api/reverse-geocode?lat=${pin[1]}&lon=${pin[0]}`)
      .then((res) => !cancelled && res.address && setAddress(res.address))
      .catch(() => {})
      .finally(() => !cancelled && setLookingUp(false));
    return () => {
      cancelled = true;
    };
  }, [pin]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = options.max_photos - photos.length;
    if (files.length > room) notify(`You can attach up to ${options.max_photos} photos.`, "error");
    setPreparing(true);
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const prepared = await preparePhoto(file);
        setPhotos((list) => [...list, prepared]);
      } catch (err) {
        notify((err as Error).message, "error");
      }
    }
    setPreparing(false);
    if (fileInput.current) fileInput.current.value = ""; // allow picking the same file again
  };

  const removePhoto = (id: string) =>
    setPhotos((list) => {
      const gone = list.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.id !== id);
    });

  const locate = () => {
    if (!navigator.geolocation) return notify("Your browser does not share location. Click the map instead.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => onPin([pos.coords.longitude, pos.coords.latitude]),
      () => notify("Could not get your location. Click the map instead.", "error"),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return notify("Click the map to mark where the damage is.", "error");
    if (!severity) return notify("Choose how severe the damage is.", "error");
    if (photos.length === 0) return notify("Attach at least one photo of the damage.", "error");

    const form = new FormData();
    form.set("city_id", String(city!.id));
    form.set("category", category);
    form.set("severity", severity);
    form.set("lat", String(pin[1]));
    form.set("lon", String(pin[0]));
    form.set("address", address);
    form.set("description", description);
    form.set("photo_meta", JSON.stringify(photos.map((p) => p.meta)));
    photos.forEach((p, i) => form.append("photos", p.blob, `photo-${i + 1}.jpg`));

    setBusy(true);
    try {
      await api("/api/reports", { body: form });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setDescription("");
      setAddress("");
      setSeverity(null);
      onPin(null);
      notify("Report sent. City staff will review it.");
      onSubmitted();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-muted">What is damaged?</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {options.damage_types.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm text-muted">How severe is it?</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.severities.map((level) => {
            const active = severity === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => setSeverity(level)}
                className="rounded-xl border px-2 py-2 text-left transition-colors"
                style={{
                  borderColor: active ? SEVERITY_COLOR[level] : "var(--color-line)",
                  background: active ? `${SEVERITY_COLOR[level]}1f` : "var(--color-panel-2)",
                }}
              >
                <div className="text-sm font-medium" style={{ color: active ? SEVERITY_COLOR[level] : undefined }}>
                  {capitalize(level)}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted">{SEVERITY_HINT[level]}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">
            Photos <span className="text-xs">(at least 1, up to {options.max_photos})</span>
          </span>
          {preparing && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1} to upload`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-critical"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {photos.length < options.max_photos && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid aspect-square place-items-center rounded-xl border border-dashed border-line bg-panel-2 text-muted transition-colors hover:border-accent hover:text-ink"
            >
              <span className="flex flex-col items-center gap-1 text-xs">
                <ImagePlus size={20} />
                Add photo
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">Where is it?</span>
          <button type="button" onClick={locate} className="flex items-center gap-1 text-xs text-accent hover:underline">
            <LocateFixed size={13} /> Use my location
          </button>
        </div>
        <input
          className="input"
          value={address}
          maxLength={300}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={pin ? (lookingUp ? "Looking up the address…" : "Street, landmark or area") : "Click the map to mark the spot"}
          aria-label="Address"
        />
        <p className="mt-1 text-xs text-muted">
          {pin
            ? `Pin set at ${pin[1].toFixed(4)}, ${pin[0].toFixed(4)}. Correct the address if it looks wrong.`
            : "The address fills in when you click the map."}
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block text-muted">
          Anything else staff should know? <span className="text-xs">(optional)</span>
        </span>
        <textarea
          className="input min-h-20"
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <button className="btn w-full" disabled={busy || preparing}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {busy ? "Sending…" : "Send report"}
      </button>
      <p className="text-xs text-muted">
        {options.photo_check.enabled
          ? `Your photos are checked automatically by an AI service (${options.photo_check.name}) and then reviewed by city staff.`
          : "Your photos are reviewed by city staff."}{" "}
        Location data hidden inside photos is removed before they are stored.
      </p>
    </form>
  );
}
