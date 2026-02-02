import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function ResetPasswordPage() {
  const router = useRouter();
  const email = useMemo(() => (router.query.email ? String(router.query.email) : ""), [router.query.email]);
  const token = useMemo(() => (router.query.token ? String(router.query.token) : ""), [router.query.token]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");

  const canSubmit = email && token && password.length >= 8 && password === confirm && status !== "saving";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("saving");
    setError("");

    try {
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        setStatus("error");
        setError(json?.error || "Reset failed. Your link may be expired.");
        return;
      }

      setStatus("done");
    } catch {
      setStatus("error");
      setError("Reset failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Choose a new password for <span className="font-medium">{email || "your account"}</span>.
          </p>

          {status === "done" ? (
            <div className="mt-6 rounded-2xl bg-neutral-100 p-4 text-sm">
              <div className="font-semibold">Password updated</div>
              <div className="mt-1 text-neutral-700">You can now sign in with your new password.</div>
              <a
                href="/auth/signin"
                className="mt-4 inline-block rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
              >
                Go to sign in
              </a>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              {!email || !token ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                  This reset link is missing required information. Please request a new reset email.
                  <div className="mt-2">
                    <a className="underline" href="/auth/forgot-password">Request a new link</a>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {status === "error" ? (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {status === "saving" ? "Saving…" : "Update password"}
              </button>

              <div className="text-sm text-neutral-700">
                <a href="/auth/signin" className="underline">Back to sign in</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
