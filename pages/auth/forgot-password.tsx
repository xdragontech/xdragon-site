import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) {
        throw new Error(body?.error || "Could not start password reset.");
      }
      setSent(true);
    } catch (nextError: any) {
      setError(nextError?.message || "Could not start password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Enter the email you used for X Dragon Tools. We’ll send a password reset link if an account exists.
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl bg-neutral-100 p-4 text-sm">
              <div className="font-semibold">Check your inbox</div>
              <div className="mt-1 text-neutral-700">
                If an account exists for <span className="font-medium">{email || "that email"}</span>, you’ll receive a reset link shortly.
              </div>
              <a href="/auth/signin" className="mt-4 inline-block underline text-sm">
                Back to sign in
              </a>
            </div>
          ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : null}

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="you@company.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
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
