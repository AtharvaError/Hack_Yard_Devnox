"use client";

import { Activity, ArrowRight, GitFork, ListChecks, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, type User } from "@/lib/api";

type Demo = { label: string; email: string; password: string };

const POINTS = [
  { icon: Activity, title: "Live risk scores", text: "Every hospital, road, bridge, substation and water facility", color: "#00e5ff" },
  { icon: GitFork, title: "Cascade simulation", text: "See what fails next when one asset goes down", color: "#7c5cff" },
  { icon: ListChecks, title: "Ranked action plan", text: "The best moves for your budget and crews", color: "#ff3cac" },
];

// A stylised city network for the hero: assets coloured by risk, with live links between them.
const NODES = [
  { x: 70, y: 90, c: "#2bff9e" },
  { x: 190, y: 50, c: "#2bff9e" },
  { x: 300, y: 120, c: "#ffd60a" },
  { x: 430, y: 70, c: "#2bff9e" },
  { x: 540, y: 140, c: "#ff8f1f" },
  { x: 120, y: 220, c: "#ffd60a" },
  { x: 250, y: 260, c: "#ff3b6b" },
  { x: 380, y: 230, c: "#2bff9e" },
  { x: 500, y: 290, c: "#ffd60a" },
  { x: 60, y: 340, c: "#2bff9e" },
  { x: 200, y: 380, c: "#ff8f1f" },
  { x: 340, y: 360, c: "#2bff9e" },
  { x: 470, y: 400, c: "#2bff9e" },
];
const LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 5], [2, 6], [5, 6], [2, 7], [3, 7], [4, 8], [7, 8],
  [6, 7], [5, 9], [6, 10], [9, 10], [10, 11], [7, 11], [11, 12], [8, 12], [6, 11],
];
const CHIPS = [
  { text: "District Hospital", level: "Critical · 82", color: "#ff3b6b", style: { top: "13%", left: "46%" }, delay: "0s" },
  { text: "River Bridge", level: "High · 64", color: "#ff8f1f", style: { top: "27%", right: "5%" }, delay: "1.5s" },
  { text: "Substation 7", level: "Low · 12", color: "#2bff9e", style: { bottom: "12%", right: "8%" }, delay: "3s" },
];

function HeroNetwork() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 600 440" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-80">
        <defs>
          <linearGradient id="link" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00e5ff" />
            <stop offset="1" stopColor="#ff3cac" />
          </linearGradient>
          <radialGradient id="fade" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="fadeMask">
            <rect width="600" height="440" fill="url(#fade)" />
          </mask>
        </defs>
        <g mask="url(#fadeMask)">
          {LINKS.map(([a, b]) => (
            <g key={`${a}-${b}`}>
              <line x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#7c5cff" strokeOpacity="0.18" strokeWidth="1" />
              <line
                className="net-flow"
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke="url(#link)"
                strokeOpacity="0.7"
                strokeWidth="1.4"
                style={{ animationDelay: `${(a * 0.37 + b * 0.21) % 1.6}s` }}
              />
            </g>
          ))}
          {NODES.map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r="12" fill={n.c} fillOpacity="0.12" className="net-node" style={{ animationDelay: `${(i * 0.43) % 3}s` }} />
              <circle cx={n.x} cy={n.y} r="4.5" fill={n.c} style={{ filter: `drop-shadow(0 0 6px ${n.c})` }} />
            </g>
          ))}
        </g>
      </svg>
      <div className="net-scan absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-accent/15 to-transparent">
        <div className="absolute inset-y-0 left-1/2 w-px bg-accent/60 shadow-[0_0_14px_var(--color-accent)]" />
      </div>
      {CHIPS.map((c) => (
        <div
          key={c.text}
          className="float-y absolute rounded-xl border bg-bg/70 px-3 py-2 text-xs backdrop-blur-md"
          style={{ ...c.style, borderColor: `${c.color}66`, boxShadow: `0 0 24px -8px ${c.color}`, animationDelay: c.delay }}
        >
          <div className="font-medium text-ink">{c.text}</div>
          <div className="mt-0.5 flex items-center gap-1.5 font-semibold" style={{ color: c.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
            {c.level}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demos, setDemos] = useState<Demo[]>([]);

  useEffect(() => {
    // Already signed in? Skip straight to the app.
    api<User>("/api/auth/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => {});
    api<Demo[]>("/api/auth/demo-accounts")
      .then(setDemos)
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { body: mode === "login" ? { email, password } : { name, email, password } });
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="relative m-3 mr-0 hidden flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#0b1030] via-[#080a1c] to-[#14081f] p-12 lg:flex">
        <HeroNetwork />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06071a] via-transparent to-[#06071a]/70" />
        <div className="relative">
          <Logo size={48} textClass="text-[26px]" />
        </div>
        <div className="relative">
          <div className="eyebrow">Hackyard Build 2026 · Team Devnox</div>
          <h1 className="mt-3 max-w-xl text-[44px] leading-[1.05] font-bold">
            Know which infrastructure will fail <span className="neon-text">before the weather arrives.</span>
          </h1>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            {POINTS.map((p) => (
              <div key={p.title} className="tile p-4" style={{ "--tone": p.color } as React.CSSProperties}>
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ color: p.color, background: `${p.color}1a`, boxShadow: `0 0 20px -6px ${p.color}` }}
                >
                  <p.icon size={18} />
                </span>
                <div className="mt-3 text-sm font-semibold">{p.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted">{p.text}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted">
          Built on free, open data: OpenStreetMap, Open-Meteo, Copernicus and NASA.
        </p>
      </div>

      <div className="grid place-items-center p-6">
        <div className="page-enter w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size={42} textClass="text-2xl" />
          </div>
          <div className="card p-7">
            <h2 className="text-[26px] font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-1 text-sm text-muted">
              {mode === "login" ? "Sign in to open the risk dashboard." : "New accounts get the citizen view."}
            </p>

            <div className="mt-6 flex rounded-2xl border border-line bg-bg/60 p-1 text-sm">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`flex-1 rounded-xl py-2 font-semibold transition-all ${
                    mode === m ? "bg-accent text-on-accent shadow-[0_0_20px_-6px_var(--color-accent)]" : "text-muted hover:text-ink"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === "register" && (
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted">Full name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
                <input
                  className="input"
                  type="email"
                  placeholder="you@city.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>
              {error && (
                <p role="alert" className="rounded-xl border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
                  {error}
                </p>
              )}
              <button className="btn w-full !py-3 text-[15px]" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {mode === "login" ? "Sign in" : "Create account"}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          </div>

          {mode === "login" && demos.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-accent/30 bg-accent/[0.04] p-4">
              <div className="eyebrow">Demo accounts</div>
              <div className="mt-3 grid gap-2">
                {demos.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                      setError(null);
                    }}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-bg/50 px-3 py-2.5 text-left text-sm transition-all hover:border-accent/50 hover:shadow-[0_0_20px_-8px_var(--color-accent)]"
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="truncate font-mono text-xs text-muted group-hover:text-accent">
                      {d.email} / {d.password}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted">Click one to fill the form, then press Sign in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
