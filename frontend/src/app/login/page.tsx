"use client";

import { Activity, GitFork, ListChecks, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

type Demo = { label: string; email: string; password: string };

const POINTS = [
  { icon: Activity, text: "Live risk scores for every hospital, road, bridge, substation and water facility" },
  { icon: GitFork, text: "See what fails next when one asset goes down" },
  { icon: ListChecks, text: "A ranked action plan that fits your budget and crews" },
];

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-side p-12 lg:flex">
        {/* Decorative city-network illustration, darkened behind the text so it stays readable. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/login-bg.svg)" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-side/90 via-side/25 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-side/55 to-transparent" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <ShieldAlert size={22} />
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            Infra<span className="text-accent">Sentinel</span>
          </span>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-4xl leading-tight font-semibold">
            Know which infrastructure will fail before the weather arrives.
          </h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-sm text-muted">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-2 text-accent">
                  <p.icon size={15} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted">
          Built on free, open data: OpenStreetMap, Open-Meteo, Copernicus and NASA.
        </p>
      </div>

      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted">
            {mode === "login" ? "Sign in to open the risk dashboard." : "New accounts get the standard user view."}
          </p>

          <div className="mt-6 flex rounded-xl border border-line bg-panel p-1 text-sm">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 font-medium transition-colors ${
                  mode === m ? "bg-accent text-white" : "text-muted hover:text-ink"
                }`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === "register" && (
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Full name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Password</span>
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
              <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
                {error}
              </p>
            )}
            <button className="btn w-full !py-2.5" disabled={busy}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          {mode === "login" && demos.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-panel p-4">
              <div className="text-xs font-medium tracking-wider text-muted uppercase">Demo accounts</div>
              <div className="mt-3 space-y-2">
                {demos.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                      setError(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg bg-panel-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/15"
                  >
                    <span className="font-medium">{d.label}</span>
                    <span className="font-mono text-xs text-muted">
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
