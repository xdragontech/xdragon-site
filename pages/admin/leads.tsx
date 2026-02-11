import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import AdminLayout from "../../components/admin/AdminLayout";
import LibraryCardHeader from "../../components/admin/LibraryCardHeader";
import { useToast } from "../../components/ui/toast";

type LeadKind = "chat" | "contact";

type LeadEvent = {
  ts: string;
  kind: LeadKind;
  ip?: string;
  ua?: string;
  referer?: string;
  [k: string]: any;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  const role = ((session as any)?.role || (session as any)?.user?.role || null) as string | null;
  const user = (session as any)?.user;

  if (!session || role !== "ADMIN") {
    return {
      redirect: {
        destination: "/admin/signin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      loggedInAs: user.email || user.name || null,
    },
  };
};

export default function LeadsPage({ loggedInAs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();

  const [items, setItems] = useState<LeadEvent[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | LeadKind>("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/leads?kind=${kind}&limit=200`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Failed to load leads");
      }
      const j = await res.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load leads");
      toast("error", `Failed to load leads: ${e?.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((x) => JSON.stringify(x).toLowerCase().includes(needle));
  }, [items, q]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${kind}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Exported JSON.");
  }

  function toCsvRow(obj: any, keys: string[]) {
    return keys
      .map((k) => {
        const v = obj?.[k];
        const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
        return `"${String(s).replace(/"/g, '""')}"`;
      })
      .join(",");
  }

  function exportCsv() {
    const keys = ["ts", "kind", "ip", "ua", "referer"];
    const extraKeys = new Set<string>();
    for (const it of filtered.slice(0, 50)) {
      Object.keys(it || {}).forEach((k) => {
        if (!keys.includes(k)) extraKeys.add(k);
      });
    }
    const header = [...keys, ...Array.from(extraKeys)].slice(0, 40); // keep it readable
    const lines = [header.join(",")];
    for (const it of filtered) lines.push(toCsvRow(it, header));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${kind}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Exported CSV.");
  }

  const topActions = (
    <>
      <button
        onClick={load}
        disabled={loading}
        className="rounded-full border border-neutral-200 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>
    </>
  );

  const bottomActions = (
    <>
      <button
        onClick={exportCsv}
        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        Export CSV
      </button>
      <button
        onClick={exportJson}
        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        Export JSON
      </button>
    </>
  );

  return (
    <AdminLayout title="X Dragon Command — Leads" sectionLabel="Leads" loggedInAs={loggedInAs} active="leads">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <LibraryCardHeader
          title="Leads"
          description="Recent contact submissions and chat lead events (backup log)."
          actionsTop={topActions}
          actionsBottom={bottomActions}
        />

        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads…"
              className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="all">All</option>
              <option value="chat">Chat</option>
              <option value="contact">Contact</option>
            </select>
          </div>

          <div className="lg:col-span-3 text-right text-sm text-neutral-600">
            <div className="pt-2">
              {filtered.length} shown
              {items.length !== filtered.length ? ` (of ${items.length})` : ""}
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left text-neutral-600">
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Kind</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="sticky right-0 px-4 py-3 font-semibold bg-neutral-50 border-l border-neutral-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, idx) => {
                const summary =
                  it.kind === "contact"
                    ? (it.message || it.subject || "").toString().slice(0, 120)
                    : (it.lastUserMessage || it.lead?.email || it.lead?.name || "").toString().slice(0, 120);

                return (
                  <tr key={`${it.kind}-${it.ts}-${idx}`} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">{new Date(it.ts).toLocaleString()}</td>
                    <td className="px-4 py-3 text-neutral-700">{it.kind}</td>
                    <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">{it.ip || ""}</td>
                    <td className="px-4 py-3 text-neutral-700">{summary}</td>
                    <td className="sticky right-0 px-4 py-3 bg-white border-l border-neutral-200 text-right">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(it, null, 2));
                          toast("success", "Copied.");
                        }}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      >
                        Copy JSON
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-600">
                    No leads found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
