import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { requireBackofficePage } from "../../../lib/backofficeAuth";
import AdminLayout from "../../../components/admin/AdminLayout";
import LibraryCardHeader from "../../../components/admin/LibraryCardHeader";
import { prisma } from "../../../lib/prisma";
import { normalizeHost } from "../../../lib/requestHost";
import {
  collectRuntimeStatus,
  collectSystemEnvGroups,
  summarizeDatabaseUrl,
  type RuntimeStatusItem,
  type SystemEnvGroup,
} from "../../../lib/admin/systemConfig";

type DatabaseStatus = {
  status: "ok" | "error" | "unconfigured";
  currentDatabase: string | null;
  currentSchema: string | null;
  expectedDatabase: string | null;
  expectedHost: string | null;
  fingerprint: string | null;
  error: string | null;
};

type ConfigsPageProps = {
  loggedInAs: string | null;
  envGroups: SystemEnvGroup[];
  runtimeStatus: RuntimeStatusItem[];
  databaseStatus: DatabaseStatus;
};

async function loadDatabaseStatus(): Promise<DatabaseStatus> {
  const databaseUrl = process.env.XD_POSTGRES?.trim() || null;
  const parsedUrl = summarizeDatabaseUrl(databaseUrl);

  if (!databaseUrl) {
    return {
      status: "unconfigured",
      currentDatabase: null,
      currentSchema: null,
      expectedDatabase: null,
      expectedHost: null,
      fingerprint: null,
      error: null,
    };
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ current_database: string; current_schema: string }>>`
      SELECT current_database() AS current_database, current_schema() AS current_schema
    `;
    const current = rows[0] || null;

    return {
      status: "ok",
      currentDatabase: current?.current_database || null,
      currentSchema: current?.current_schema || null,
      expectedDatabase: parsedUrl?.database || null,
      expectedHost: parsedUrl?.host || null,
      fingerprint: parsedUrl?.fingerprint || null,
      error: null,
    };
  } catch (error) {
    return {
      status: "error",
      currentDatabase: null,
      currentSchema: null,
      expectedDatabase: parsedUrl?.database || null,
      expectedHost: parsedUrl?.host || null,
      fingerprint: parsedUrl?.fingerprint || null,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export const getServerSideProps: GetServerSideProps<ConfigsPageProps> = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/settings/configs",
  });
  if (!auth.ok) return auth.response;

  ctx.res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  ctx.res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const forwardedHost = ctx.req.headers["x-forwarded-host"];
  const directHost = ctx.req.headers.host;
  const requestHost = normalizeHost(
    Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost || (Array.isArray(directHost) ? directHost[0] : directHost) || ""
  );

  return {
    props: {
      loggedInAs: auth.loggedInAs,
      envGroups: collectSystemEnvGroups().filter((group) => group.key !== "brand"),
      runtimeStatus: await collectRuntimeStatus(requestHost),
      databaseStatus: await loadDatabaseStatus(),
    },
  };
};

function StatusPill({ tone, children }: { tone: "neutral" | "success" | "warning" | "error"; children: string }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function RuntimeGrid({ items }: { items: RuntimeStatusItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
          <div className="mt-2 break-all text-sm font-semibold text-neutral-900">{item.value}</div>
          {item.note ? <p className="mt-2 text-xs leading-5 text-neutral-600">{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export default function ConfigsPage({
  loggedInAs,
  envGroups,
  runtimeStatus,
  databaseStatus,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const databaseTone =
    databaseStatus.status === "ok" ? "success" : databaseStatus.status === "unconfigured" ? "warning" : "error";
  const databaseLabel =
    databaseStatus.status === "ok" ? "Connected" : databaseStatus.status === "unconfigured" ? "Not Configured" : "Error";

  const topActions = (
    <Link
      href="/admin/settings/configs"
      className="rounded-full border border-neutral-200 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
    >
      Refresh
    </Link>
  );

  return (
    <AdminLayout title="X Dragon Command — Configs" sectionLabel="Settings / Configs" loggedInAs={loggedInAs} active="settings">
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <LibraryCardHeader
            title="Configs"
            description="Read-only system diagnostics for the website runtime, backoffice auth surfaces that still live in this repo, and the website-to-command integration boundary."
            actionsTop={topActions}
          />

          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            This page is for operational runtime, auth, database, and website-to-command integration diagnostics. Brand identity
            and brand-host relationships have been moved out so they can become their own live source of truth.
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            Public AI, email, and rate-limit provider credentials now belong to Command. This view should show the website BFF
            integration envs instead of the old public-service provider keys.
          </div>
        </div>

        {envGroups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">{group.title}</h2>
              <p className="mt-1 text-sm text-neutral-600">{group.description}</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-neutral-600">
                    <th className="px-4 py-3 font-semibold">Variable</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.key} className="border-t border-neutral-200 align-top">
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-semibold text-neutral-900">{item.key}</div>
                        <div className="mt-1 text-sm text-neutral-900">{item.label}</div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill tone={item.status === "present" ? "success" : "warning"}>
                          {item.status === "present" ? "Present" : "Missing"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-4">
                        <div className="break-all font-mono text-xs text-neutral-900">{item.value}</div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-neutral-700">{item.description}</p>
                        {item.meta?.length ? (
                          <div className="mt-2 space-y-1 text-xs text-neutral-600">
                            {item.meta.map((meta) => (
                              <div key={`${item.key}-${meta.label}`}>
                                <span className="font-semibold text-neutral-700">{meta.label}:</span> {meta.value}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Runtime Status</h2>
            <p className="mt-1 text-sm text-neutral-600">Live request and database checks from the current server runtime.</p>
          </div>

          <RuntimeGrid items={runtimeStatus} />

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Database Runtime Check</div>
                <div className="mt-1 text-sm text-neutral-700">
                  Confirms what the running app can currently connect to, which is stronger evidence than dashboard env settings
                  alone.
                </div>
              </div>
              <StatusPill tone={databaseTone}>{databaseLabel}</StatusPill>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Expected Host</div>
                <div className="mt-2 break-all text-sm font-semibold text-neutral-900">{databaseStatus.expectedHost || "Unknown"}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Expected Database</div>
                <div className="mt-2 break-all text-sm font-semibold text-neutral-900">
                  {databaseStatus.expectedDatabase || "Unknown"}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Connected Database</div>
                <div className="mt-2 break-all text-sm font-semibold text-neutral-900">
                  {databaseStatus.currentDatabase || "Unavailable"}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Current Schema</div>
                <div className="mt-2 break-all text-sm font-semibold text-neutral-900">
                  {databaseStatus.currentSchema || "Unavailable"}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-700">Configured Variable:</span> XD_POSTGRES
            </div>

            <div className="mt-2 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-700">Database URL Fingerprint:</span>{" "}
              {databaseStatus.fingerprint || "Unavailable"}
            </div>

            {databaseStatus.error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {databaseStatus.error}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
