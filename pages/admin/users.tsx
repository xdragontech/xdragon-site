// pages/admin/users.tsx
import type { GetServerSideProps } from "next";
import { requireAdmin } from "../../lib/auth";
import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  status: "ACTIVE" | "BLOCKED";
  role: "USER" | "ADMIN";
  createdAt: string;
  lastLoginAt: string | null;
};

type Props = { ok: true };

export default function AdminUsers(_: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    setUsers(json.users || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: "ACTIVE" | "BLOCKED") {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
    else alert("Failed to update user status.");
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="font-semibold">Admin — Users</div>
          <a href="/" className="text-sm font-medium hover:underline">
            Back to site
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold">User Access</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Blocked users cannot sign in. Admin access + signup notifications use <code className="font-mono">ADMIN_EMAILS</code>.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="text-sm font-semibold">Users</div>
            <button
              onClick={load}
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-neutral-600">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-left p-3">Last login</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-neutral-200">
                      <td className="p-3">{u.email || "—"}</td>
                      <td className="p-3">{u.name || "—"}</td>
                      <td className="p-3">{u.role}</td>
                      <td className="p-3">
                        <span className={u.status === "ACTIVE" ? "text-emerald-700" : "text-red-700"}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3">{new Date(u.createdAt).toLocaleString()}</td>
                      <td className="p-3">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                      <td className="p-3 text-right">
                        {u.status === "ACTIVE" ? (
                          <button
                            onClick={() => setStatus(u.id, "BLOCKED")}
                            className="rounded-xl bg-black text-white px-3 py-2 text-xs font-semibold hover:opacity-90"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(u.id, "ACTIVE")}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                          >
                            Unblock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="p-6 text-sm text-neutral-600" colSpan={7}>
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { session, isAdmin } = await requireAdmin(ctx);
  if (!session?.user?.email) return { redirect: { destination: "/auth/signin", permanent: false } };
  if (!isAdmin) return { notFound: true };

  return { props: { ok: true } };
};
