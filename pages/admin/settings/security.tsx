import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useEffect, useState } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import LibraryCardHeader from "../../../components/admin/LibraryCardHeader";
import { useToast } from "../../../components/ui/toast";
import { requireBackofficePage } from "../../../lib/backofficeAuth";

type SecurityPageProps = {
  loggedInAs: string | null;
};

type MfaStatus = {
  state: "DISABLED" | "PENDING" | "ENABLED";
  method: "AUTHENTICATOR_APP" | null;
  enabledAt: string | null;
  recoveryCodesGeneratedAt: string | null;
  issuer: string;
  encryptionReady: boolean;
  setupSecret: string | null;
  otpAuthUrl: string | null;
  recoveryCodes: string[] | null;
};

export const getServerSideProps: GetServerSideProps<SecurityPageProps> = async (ctx) => {
  const auth = await requireBackofficePage(ctx, {
    callbackUrl: "/admin/settings/security",
  });
  if (!auth.ok) return auth.response;

  return {
    props: {
      loggedInAs: auth.loggedInAs,
    },
  };
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function StatusPill({ state }: { state: MfaStatus["state"] }) {
  const cls =
    state === "ENABLED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state === "PENDING"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-neutral-200 bg-neutral-50 text-neutral-600";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>MFA {state}</span>;
}

export default function SecurityPage({ loggedInAs }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<"start" | "verify" | "cancel" | null>(null);
  const [code, setCode] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/mfa");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to load MFA status");
      setStatus(body.status);
    } catch (nextError: any) {
      const message = nextError?.message || "Failed to load MFA status";
      setError(message);
      toast("error", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function runAction(action: "start" | "verify" | "cancel") {
    if (action === "verify" && !code.trim()) {
      const message = "Enter the 6-digit code from your authenticator app.";
      setError(message);
      toast("error", message);
      return;
    }

    setActionBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          code: action === "verify" ? code.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || "MFA action failed");
      setStatus(body.status);
      if (action === "verify") setCode("");
      toast("success", action === "start" ? "Authenticator setup started." : action === "verify" ? "Authenticator MFA enabled." : "Pending setup cancelled.");
    } catch (nextError: any) {
      const message = nextError?.message || "MFA action failed";
      setError(message);
      toast("error", message);
    } finally {
      setActionBusy(null);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("success", `${label} copied.`);
    } catch {
      toast("error", `Failed to copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <AdminLayout title="X Dragon Command — Security" sectionLabel="Settings / Security" loggedInAs={loggedInAs} active="settings">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <LibraryCardHeader
            title="Security"
            description="Set up your own authenticator-app MFA for backoffice access. Enforcement is not active yet, but this is the enrollment path we will use."
            actionsTop={
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                disabled={loading}
              >
                Refresh
              </button>
            }
          />

          {!status ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
              {loading ? "Loading…" : "Security status unavailable."}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</div>
                  <div className="mt-2">{<StatusPill state={status.state} />}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Method</div>
                  <div className="mt-2 text-sm text-neutral-800">
                    {status.method === "AUTHENTICATOR_APP" ? "Authenticator App" : "Not configured"}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Enabled</div>
                  <div className="mt-2 text-sm text-neutral-800">{formatDate(status.enabledAt)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recovery Codes</div>
                  <div className="mt-2 text-sm text-neutral-800">{formatDate(status.recoveryCodesGeneratedAt)}</div>
                </div>
              </div>

              {!status.encryptionReady ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  `BACKOFFICE_MFA_ENCRYPTION_KEY` is missing. Add it before enrolling authenticator-based MFA.
                </div>
              ) : null}

              {status.state === "DISABLED" ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <div className="text-sm text-neutral-700">
                    Authenticator MFA is not configured on this account yet. Start setup to generate a secret and recovery codes.
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void runAction("start")}
                      disabled={actionBusy !== null || !status.encryptionReady}
                      className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionBusy === "start" ? "Starting…" : "Set Up Authenticator"}
                    </button>
                  </div>
                </div>
              ) : null}

              {status.state === "PENDING" ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="text-sm font-semibold text-amber-900">Setup In Progress</div>
                    <p className="mt-2 text-sm text-amber-800">
                      Add this account to your authenticator app, then verify with a current 6-digit code.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                      <div className="text-sm font-semibold text-neutral-900">Authenticator Details</div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Issuer</div>
                          <div className="mt-2 text-sm text-neutral-900">{status.issuer}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Manual Setup Key</div>
                          <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 font-mono text-xs text-neutral-900 break-all">
                            {status.setupSecret || "Unavailable"}
                          </div>
                          {status.setupSecret ? (
                            <button
                              type="button"
                              onClick={() => void copyValue(status.setupSecret || "", "Secret")}
                              className="mt-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              Copy Secret
                            </button>
                          ) : null}
                        </div>
                        {status.otpAuthUrl ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Setup URI</div>
                            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 font-mono text-xs text-neutral-900 break-all">
                              {status.otpAuthUrl}
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyValue(status.otpAuthUrl || "", "Setup URI")}
                              className="mt-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              Copy URI
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                      <div className="text-sm font-semibold text-neutral-900">Recovery Codes</div>
                      <p className="mt-2 text-sm text-neutral-600">
                        Save these now. They will not be shown again after setup is complete.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {(status.recoveryCodes || []).map((recoveryCode) => (
                          <div
                            key={recoveryCode}
                            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-900"
                          >
                            {recoveryCode}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="text-sm font-semibold text-neutral-900">Verify Authenticator Code</div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                        placeholder="123456"
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 sm:max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void runAction("verify")}
                        disabled={actionBusy !== null}
                        className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionBusy === "verify" ? "Verifying…" : "Verify & Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction("cancel")}
                        disabled={actionBusy !== null}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionBusy === "cancel" ? "Cancelling…" : "Cancel Setup"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {status.state === "ENABLED" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-sm font-semibold text-emerald-900">Authenticator MFA Enabled</div>
                  <p className="mt-2 text-sm text-emerald-800">
                    Your backoffice account is enrolled with an authenticator app. Login enforcement is not active yet, but this account is ready.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
