import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { MIN_BACKOFFICE_PASSWORD_LENGTH } from "../../lib/backofficePasswordPolicy";

function readQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const userId = useMemo(() => readQueryValue(router.query.id), [router.query.id]);
  const token = useMemo(() => readQueryValue(router.query.token), [router.query.token]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userId || !token) {
      setError("This password link is invalid or incomplete.");
      return;
    }

    if (password.length < MIN_BACKOFFICE_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_BACKOFFICE_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          token,
          password,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || "Failed to reset password");
      }

      setSuccess("Password updated. You can sign in to the backoffice now.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        window.location.assign("/admin/signin?reset=1");
      }, 900);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>X Dragon Command — Reset Password</title>
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
      </Head>

      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="mb-8 flex items-start justify-center gap-4">
            <div className="flex flex-col items-start">
              <img src="/logo.png" alt="X Dragon Technologies logo" className="h-11 w-auto" />
              <div
                className="mt-1 font-semibold leading-none text-neutral-900"
                style={{ fontFamily: "Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", fontSize: "1.6875rem" }}
              >
                Command
              </div>
            </div>
            <div className="flex h-11 items-center">
              <div className="text-sm text-neutral-600">Admin access</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Set Your Password</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Use this one-time link to set a new password for your backoffice account.
            </p>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {success}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">New Password</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={`Minimum ${MIN_BACKOFFICE_PASSWORD_LENGTH} characters`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">Confirm Password</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Updating…" : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
