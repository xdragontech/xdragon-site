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

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErr, setGeoErr] = useState<string>("");
  const [geoResult, setGeoResult] = useState<any>(null);

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


  async function previewGeoBackfill() {
    setGeoLoading(true);
    setGeoErr("");
    try {
      const res = await fetch("/api/admin/backfill-login-geo?limit=500&dryRun=true");
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to preview geo backfill");
      setGeoResult(j);
      toast("success", `Preview: ${j.updated || 0} updates ready • ${j.remainingMissing ?? "?"} remaining`);
    } catch (e: any) {
      setGeoErr(e?.message || "Failed to preview geo backfill");
      toast("error", `Geo backfill preview failed: ${e?.message || "Please try again."}`);
    } finally {
      setGeoLoading(false);
    }
  }

  async function runGeoBackfill() {
    setGeoLoading(true);
    setGeoErr("");
    try {
      const res = await fetch("/api/admin/backfill-login-geo?limit=500", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to run geo backfill");
      setGeoResult(j);
      toast("success", `Backfilled ${j.updated || 0} login events`);
      // Refresh analytics after backfill so cards update immediately.
      load();
    } catch (e: any) {
      setGeoErr(e?.message || "Failed to run geo backfill");
      toast("error", `Geo backfill failed: ${e?.message || "Please try again."}`);
    } finally {
      setGeoLoading(false);
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
          description="High-level lead analytics (DB source of truth). Contact and chat leads are persisted to Postgres for durable records and consistent reporting."
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
              value={data ? String((data.last7d.contact || 0) + (data.last7d.chat || 0)) : "—"}
              hint={data ? `Contact: ${data.last7d.contact} • Chat: ${data.last7d.chat}` : "Contact + chat leads in the last 7 days."}
            />
          </div>
        </div>

        
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Geo Backfill</div>
              <div className="mt-1 text-sm text-neutral-700">
                Older login events may not have country data stored. Run this once to backfill missing geo so “Top Countries” and the CTRY
                column reflect historical logins.
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={previewGeoBackfill}
                disabled={geoLoading}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              >
                {geoLoading ? "Working…" : "Preview"}
              </button>
              <button
                type="button"
                onClick={runGeoBackfill}
                disabled={geoLoading}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {geoLoading ? "Working…" : "Run backfill"}
              </button>
            </div>
          </div>

          {geoErr ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{geoErr}</div>
          ) : null}

          {geoResult ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <span className="font-semibold text-neutral-900">Processed:</span> {geoResult.processed ?? "—"}
                </span>
                <span>
                  <span className="font-semibold text-neutral-900">Updated:</span> {geoResult.updated ?? "—"}
                </span>
                <span>
                  <span className="font-semibold text-neutral-900">Unresolved:</span> {geoResult.unresolved ?? "—"}
                </span>
                <span>
                  <span className="font-semibold text-neutral-900">Remaining:</span> {geoResult.remainingMissing ?? "—"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

<div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="font-semibold text-neutral-900">Notes</div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Contact submissions and chat leads are written to the database so you can cross-reference and keep a durable record.</li>
            <li>Leads and analytics now share the same source of truth (Postgres Lead records).</li>
            <li>
              Last updated: {data ? new Date(data.updatedAt).toLocaleString() : "—"}
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
