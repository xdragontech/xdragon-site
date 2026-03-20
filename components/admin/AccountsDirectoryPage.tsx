import Head from "next/head";
import { signOut } from "next-auth/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";

export type ManagedAccountRow = {
  id: string;
  status: "ACTIVE" | "BLOCKED";
  createdAt?: string | null;
  [key: string]: any;
};

type Column<Row extends ManagedAccountRow> = {
  header: string;
  className?: string;
  render: (row: Row) => ReactNode;
};

type ExportField<Row extends ManagedAccountRow> = {
  header: string;
  get: (row: Row) => any;
};

type ApiOk<Row extends ManagedAccountRow> = {
  ok: true;
  users: Row[];
};

type ApiErr = {
  ok: false;
  error: string;
};

type AccountsDirectoryPageProps<Row extends ManagedAccountRow> = {
  browserTitle: string;
  headerLabel: string;
  heading: string;
  description: string;
  searchPlaceholder: string;
  exportBaseName: string;
  listApiPath: string;
  itemApiBasePath: string;
  columns: Array<Column<Row>>;
  exportFields: Array<ExportField<Row>>;
  searchText: (row: Row) => string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv<Row extends ManagedAccountRow>(rows: Row[], fields: Array<ExportField<Row>>) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = fields.map((f) => esc(f.header)).join(",");
  const lines = rows.map((r) => fields.map((f) => esc(f.get(r))).join(","));
  return [header, ...lines].join("\n");
}

function exportXls<Row extends ManagedAccountRow>(rows: Row[], fields: Array<ExportField<Row>>, exportBaseName: string) {
  const escape = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const header = fields.map((f) => `<th>${escape(f.header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const tds = fields.map((f) => `<td>${escape(f.get(row))}</td>`).join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const htmlDoc = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob([htmlDoc], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, `${exportBaseName}-${stamp()}.xls`);
}

export default function AccountsDirectoryPage<Row extends ManagedAccountRow>({
  browserTitle,
  headerLabel,
  heading,
  description,
  searchPlaceholder,
  exportBaseName,
  listApiPath,
  itemApiBasePath,
  columns,
  exportFields,
  searchText,
}: AccountsDirectoryPageProps<Row>) {
  const [loggedInAs, setLoggedInAs] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const email = (s?.user?.email || "").toString();
        setLoggedInAs(email);
      })
      .catch(() => {});
  }, []);

  async function load() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch(listApiPath);
      const j = (await r.json().catch(() => null)) as ApiOk<Row> | ApiErr | null;
      if (!r.ok || !j || (j as any).ok !== true) throw new Error((j as any)?.error || "Failed to load accounts");
      setUsers((j as ApiOk<Row>).users || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [listApiPath]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((row) => searchText(row).toLowerCase().includes(s));
  }, [q, searchText, users]);

  async function act(userId: string, action: "block" | "unblock" | "delete") {
    if (action === "delete") {
      const ok = confirm("Delete this account? This cannot be undone.");
      if (!ok) return;
    }

    setErr(null);
    setMsg(null);
    setBusyId(userId);

    try {
      const url = `${itemApiBasePath}/${encodeURIComponent(userId)}`;
      const r =
        action === "delete"
          ? await fetch(url, { method: "DELETE" })
          : await fetch(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Request failed");

      setMsg(action === "delete" ? "Account deleted." : "Account updated.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>{browserTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-start">
              <img src="/logo.png" alt="X Dragon logo" className="h-11 w-auto" />
              <div
                className="mt-1 font-semibold leading-none text-neutral-900"
                style={{ fontFamily: "Orbitron, ui-sans-serif, system-ui", fontSize: "1.6875rem" }}
              >
                Command
              </div>
            </div>
            <div className="flex h-11 items-center">
              <div className="text-sm text-neutral-600">{headerLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <button
                onClick={() => signOut({ callbackUrl: "/admin/signin" })}
                className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Sign out
              </button>
              {loggedInAs ? <div className="mt-2 text-sm text-neutral-600">Logged in as: {loggedInAs}</div> : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="accounts" />

          <section className="lg:col-span-10">
            {(err || msg) && (
              <div className="mb-4 space-y-2">
                {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}
                {msg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {msg}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-lg font-semibold">{heading}</h1>
                  <p className="mt-1 text-sm text-neutral-600">{description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    disabled={loading}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = toCsv(filtered, exportFields);
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      downloadBlob(blob, `${exportBaseName}-${stamp()}.csv`);
                    }}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    disabled={loading || filtered.length === 0}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportXls(filtered, exportFields, exportBaseName)}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    disabled={loading || filtered.length === 0}
                  >
                    Export XLS
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </div>

              <div className="mt-3 text-sm text-neutral-500">
                {loading ? "Loading…" : `${filtered.length} account${filtered.length === 1 ? "" : "s"}`}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr className="text-left">
                      {columns.map((column) => (
                        <th key={column.header} className={`px-4 py-3 font-medium ${column.className || ""}`}>
                          {column.header}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-6 text-neutral-500" colSpan={columns.length + 1}>
                          Loading…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-neutral-500" colSpan={columns.length + 1}>
                          No accounts found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const busy = busyId === row.id;
                        return (
                          <tr key={row.id} className="hover:bg-neutral-50">
                            {columns.map((column) => (
                              <td key={column.header} className={`px-4 py-3 text-neutral-700 ${column.className || ""}`}>
                                {column.render(row)}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {row.status === "ACTIVE" ? (
                                  <button
                                    type="button"
                                    onClick={() => void act(row.id, "block")}
                                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                    disabled={busy}
                                  >
                                    Block
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void act(row.id, "unblock")}
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                    disabled={busy}
                                  >
                                    Unblock
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => void act(row.id, "delete")}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                  disabled={busy}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-neutral-500">Exports download in your browser and are not stored in the DB.</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export { fmtDate };
