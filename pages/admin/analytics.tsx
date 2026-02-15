import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import AdminLayout from "../../components/admin/AdminLayout";
import LibraryCardHeader from "../../components/admin/LibraryCardHeader";
import { useToast } from "../../components/ui/toast";

type AnalyticsPayload = {
  ok: true;
  totals: {
    total: number;
    contact: number;
    chat: number;
  };
  last7d: {
    contact: number;
    chat: number;
  };
  updatedAt: string;
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

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-neutral-900">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-neutral-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-neutral-600">{hint}</div> : null}
    </div>
  );
}

export default function AnalyticsPage({ loggedInAs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/analytics");
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to load analytics");
      setData(j as AnalyticsPayload);
    } catch (e: any) {
      setErr(e?.message || "Failed to load analytics");
      toast("error", `Failed to load analytics: ${e?.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topActions = (
    <button
      onClick={load}
      disabled={loading}
      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
    >
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );

  return (
    <AdminLayout title="X Dragon Command — Analytics" sectionLabel="Analytics" loggedInAs={loggedInAs} active="analytics">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <LibraryCardHeader
          title="Analytics"
          description="High-level lead analytics. Contacts are stored in the database for cross-referencing; chat lead analytics will expand as chat events are persisted in DB."
          actionsTop={topActions}
        />

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <StatCard
              label="Total Leads (DB)"
              value={data ? String(data.totals.total) : "—"}
              hint="All leads stored in Postgres."
            />
          </div>
          <div className="lg:col-span-4">
            <StatCard
              label="Contact Leads (DB)"
              value={data ? String(data.totals.contact) : "—"}
              hint="Website contact form submissions."
            />
          </div>
          <div className="lg:col-span-4">
            <StatCard
              label="Last 7 Days"
              value={data ? String(data.last7d.contact) : "—"}
              hint="Contact leads in the last 7 days."
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="font-semibold text-neutral-900">Notes</div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Contact submissions are now written to the database so you can cross-reference and keep a durable record.</li>
            <li>Chat lead analytics will become richer once chat lead events are also persisted in DB (we can add that next).</li>
            <li>
              Last updated: {data ? new Date(data.updatedAt).toLocaleString() : "—"}
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
