// pages/auth/signin.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/router";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

function prettyAuthError(code?: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "CredentialsSignin":
      return "Incorrect email or password, or your email isn't verified yet.";
    case "AccessDenied":
      return "Access denied. Your account may be blocked or not eligible.";
    case "OAuthAccountNotLinked":
      return "That email is already linked to a different sign-in method.";
    default:
      // For unknown codes, show the code (helps debugging) but keep it user-friendly.
      return `Sign-in failed (${code}). Please try again.`;
  }
}

export default function SignInPage() {
  const router = useRouter();
  const callbackUrl = useMemo(() => {
    const raw = router.query.callbackUrl;
    return typeof raw === "string" && raw.length ? raw : "/tools";
  }, [router.query.callbackUrl]);

  const [providers, setProviders] = useState<ProviderMap>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Load providers (for OAuth buttons if enabled)
  useEffect(() => {
    (async () => {
      try {
        const p = await getProviders();
        setProviders(p);
      } catch {
        setProviders(null);
      }
    })();
  }, []);

  // Surface NextAuth redirect errors like /auth/signin?error=CredentialsSignin
  useEffect(() => {
    const q = router.query.error;
    const code = typeof q === "string" ? q : Array.isArray(q) ? q[0] : null;
    const msg = prettyAuthError(code);
    if (msg) setError(msg);
  }, [router.query.error]);

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const e1 = email.trim().toLowerCase();
    const p1 = password.trim();

    if (!e1 || !p1) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      // IMPORTANT: redirect:false so we can surface errors instead of silently bouncing back.
      const res = await signIn("credentials", {
        redirect: false,
        email: e1,
        password: p1,
        callbackUrl,
      });

      // res can be undefined in edge cases; treat as failure.
      if (!res) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      if (res.ok) {
        // NextAuth returns url even with redirect:false
        const dest = res.url || callbackUrl;
        await router.push(dest);
        return;
      }

      const msg = prettyAuthError(res.error ?? null) || "Sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-neutral-600">Access the X Dragon prompt library and tools.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {info && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        <form onSubmit={onPasswordSignIn} className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-4 flex items-center justify-between text-sm">
            <a className="underline" href="/auth/forgot-password">
              Forgot password?
            </a>
            <a className="underline" href="/auth/signup">
              Create account
            </a>
          </div>
        </form>

        {/* Optional OAuth providers (if configured). */}
        {providers && (providers.google || providers.github) && (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-neutral-700">Or continue with</p>
            <div className="mt-4 grid gap-3">
              {providers.google && (
                <button
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn("google", { callbackUrl })}
                  type="button"
                >
                  Continue with Google
                </button>
              )}
              {providers.github && (
                <button
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn("github", { callbackUrl })}
                  type="button"
                >
                  Continue with GitHub
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
