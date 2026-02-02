// pages/auth/signup.tsx
import React, { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) return setError("Please enter a valid email.");
    if (password.length < 10) return setError("Password must be at least 10 characters.");

    setBusy(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password, name: name.trim() || null }),
      });
      // We intentionally don't rely on response body for user-existence privacy.
      await resp.json().catch(() => ({}));
      setSent(true);
    } catch {
      setError("Could not start signup. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-neutral-600">Get access to the prompt library and AI tools.</p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-neutral-50 border border-neutral-200 p-4">
            <p className="text-sm text-neutral-800 font-medium">Check your inbox</p>
            <p className="mt-2 text-sm text-neutral-700">
              We sent a verification link to <span className="font-semibold">{email.trim()}</span>. Click it to activate
              your account.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/auth/signin" className="rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold">
                Back to Login
              </Link>
              <Link href="/" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold">
                Back to Site
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grant"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters"
              />
              <p className="mt-2 text-xs text-neutral-500">
                We’ll email you a link to verify your account before you can log in.
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Sending..." : "Create Account"}
            </button>

            <p className="text-sm text-neutral-600">
              Already have an account?{" "}
              <Link href="/auth/signin" className="font-semibold underline">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
