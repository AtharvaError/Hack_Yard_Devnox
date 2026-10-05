"use client";

import { AdminOnly } from "@/components/AdminOnly";
import { Card, ErrorNote, PageTitle, Skeleton } from "@/components/ui";
import { api, type Role } from "@/lib/api";
import { useApi, useApp } from "@/lib/store";

type Row = { id: number; email: string; name: string; role: Role; created_at: string };

function UsersView() {
  const { user, notify } = useApp();
  const { data, error, reload } = useApi<Row[]>("/api/users");

  const setRole = async (row: Row, role: Role) => {
    const verb = role === "admin" ? "Give administrator access to" : "Remove administrator access from";
    if (!window.confirm(`${verb} ${row.email}?`)) return;
    try {
      await api(`/api/users/${row.id}`, { method: "PATCH", body: { role } });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  return (
    <div>
      <PageTitle title="Users" subtitle="Anyone can sign up as a normal user. Only administrators can promote an account." />
      <Card>
        {error && <ErrorNote message={error} onRetry={reload} />}
        {!data && !error && <Skeleton className="h-48" />}
        {data && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-3 pr-3">{row.name}</td>
                  <td className="py-3 pr-3 text-muted">{row.email}</td>
                  <td className="py-3 pr-3 text-muted">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.role === "admin" ? "bg-accent/20 text-accent" : "bg-low/15 text-low"}`}>
                      {row.role === "admin" ? "Administrator" : "User"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {row.id === user.id ? (
                      <span className="text-xs text-muted">You</span>
                    ) : (
                      <button className="btn btn-ghost !py-1.5" onClick={() => setRole(row, row.role === "admin" ? "user" : "admin")}>
                        {row.role === "admin" ? "Make user" : "Make administrator"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminOnly>
      <UsersView />
    </AdminOnly>
  );
}
