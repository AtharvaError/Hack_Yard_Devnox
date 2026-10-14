"use client";

import { MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { CitySearch, Topbar } from "@/components/Topbar";
import { ApiError, api, type User } from "@/lib/api";
import { LangProvider } from "@/lib/i18n";
import { AppProvider, useApp } from "@/lib/store";

function Content({ children }: { children: React.ReactNode }) {
  const { city, loadingCity } = useApp();

  if (loadingCity) {
    return (
      <div className="grid h-full place-items-center">
        <div className="card max-w-md p-8 text-center">
          <LogoMark size={56} decorative className="mx-auto" />
          <h2 className="mt-4 text-lg font-semibold">Building the risk model for {loadingCity}</h2>
          <p className="mt-2 text-sm text-muted">
            Fetching infrastructure from OpenStreetMap, terrain from the Copernicus elevation model and the live
            forecast. A new city usually takes 20 to 60 seconds; after that it opens instantly.
          </p>
        </div>
      </div>
    );
  }

  if (!city) {
    return (
      <div className="grid h-full place-items-center">
        <div className="card flex w-full max-w-lg flex-col items-center p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
            <MapPinned size={24} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Choose a city to analyse</h2>
          <p className="mt-2 mb-5 text-sm text-muted">
            Type any city in the world. InfraSentinel pulls its hospitals, roads, bridges, power and water assets and
            scores them against the live weather forecast.
          </p>
          <CitySearch autoFocus />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch((err) => {
        // Only a real "not signed in" sends people to the login page; a backend hiccup should not.
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setOffline(true);
      });
  }, [router]);

  if (offline) {
    return (
      <div className="grid h-screen place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Cannot reach the server</h1>
          <p className="mt-2 text-sm text-muted">
            The backend is not responding. Start it, then try again.
          </p>
          <button className="btn mt-5" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid h-screen place-items-center">
        <LogoMark size={64} />
      </div>
    );
  }

  return (
    <AppProvider user={user}>
      <LangProvider>
        <div className="flex h-dvh overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
              <Content>{children}</Content>
            </main>
            <MobileNav />
          </div>
        </div>
      </LangProvider>
    </AppProvider>
  );
}
