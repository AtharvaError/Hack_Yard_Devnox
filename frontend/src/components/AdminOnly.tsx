"use client";

import { Lock } from "lucide-react";
import { useApp } from "@/lib/store";

/** The API enforces roles; this just gives a normal user a clear message instead of an error. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useApp();
  if (isAdmin) return <>{children}</>;
  return (
    <div className="grid h-full place-items-center">
      <div className="card max-w-sm p-8 text-center">
        <Lock className="mx-auto text-accent" />
        <h2 className="mt-3 text-lg font-semibold">Administrators only</h2>
        <p className="mt-2 text-sm text-muted">This tool is available to administrator accounts.</p>
      </div>
    </div>
  );
}
