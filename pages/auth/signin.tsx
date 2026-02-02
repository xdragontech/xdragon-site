// pages/auth/signin.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/router";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

function humanizeError(code: string) {
  switch (code) {
    case "CredentialsSignin":
      return "Invalid email or password.";
    case "AccessDenied":
      return "Access denied. If you just created an account, please verify your email first.";
    case "Verification":
      return "That sign-in link is invalid or expired. Please request a new one.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function SignInPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderMap>(null);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [magicEmail, setMagicEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryError = useMemo(() => {
    const e = router.query.error;
    return typeof e === "string" ? e : null;
  }, [router.query.error]);

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    if (queryError) setError(humanizeError(queryError));
  }, [queryError]);

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailNorm = magicEmail.trim().toLowerCase();
    if (!emailNorm) {
      setError("Please enter your email.");
      return;
    }

    setLoadingMagic(true);
    try {
      // redirect:false keeps user on page and lets us show success message
      const res = await signIn("email", { email: emailNorm, redirect: false, callbackUrl: "/tools" });
      if (res?.error) {
        setError(humanizeError(res.error));
      } else {
        setMessage("Magic link sent — check your inbox.");
      }
    } catch {
      setError("Could not send magic link. Please try again.");
    } finally {
      setLoadingMagic(false);
    }
  }

  async function onPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailNorm = email.trim().toLowerCase();
    const pass = password.trim();

    if (!emailNorm || !pass) {
      setError("Please enter your email and password.");
      return;
    }

    setLoadingPassword(true);
    try {
      // IMPORTANT: redirect:false to avoid "stuck" UI loops
      const res = await signIn("credentials", { email: emailNorm, password: pass, redirect: false });
      if (res?.error) {
        setError(humanizeError(res.error));
        setLoadingPassword(false);
        return;
      }
      // Success: go to tools
      await router.push("/tools");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoadingPassword(false);
    }
  }

  const oauthProviders = useMemo(() => {
    if (!providers) return [];
    return Object.values(providers).filter((p) => p.id === "google" || p.id === "github");
  }, [providers]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 shadow-sm p-6 sm:p-8">
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-neutral-600">
          Access the prompt library and tools. Use a magic link or your password.
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {/* Email magic link */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Email magic link</h2>
          <form onSubmit={onMagicLink} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                type="email"
                className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit"
              disabled={loadingMagic}
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loadingMagic ? "Sending…" : "Send magic link"}
            </button>
          </form>
        </div>

        <div className="my-8 border-t border-neutral-200" />

        {/* Password login */}
        <div>
          <h2 className="text-lg font-semibold">Password login</h2>
          <form onSubmit={onPasswordLogin} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <a href="/auth/forgot-password" className="text-neutral-700 hover:text-black underline">
                Forgot password?
              </a>
              <a href="/auth/signup" className="text-neutral-700 hover:text-black underline">
                Create account
              </a>
            </div>

            <button
              type="submit"
              disabled={loadingPassword}
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loadingPassword ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-xs text-neutral-500">
              Password accounts require email verification before they can sign in.
            </p>
          </form>
        </div>

        {/* OAuth */}
        {oauthProviders.length > 0 && (
          <>
            <div className="my-8 border-t border-neutral-200" />
            <div>
              <h2 className="text-lg font-semibold">Or continue with</h2>
              <div className="mt-4 space-y-3">
                {oauthProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => signIn(p.id, { callbackUrl: "/tools" })}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                    type="button"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
