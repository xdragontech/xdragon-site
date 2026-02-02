// pages/auth/signin.tsx
import React, { useMemo, useState } from "react";
import { signIn, getProviders } from "next-auth/react";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

export default function SignInPage({ providers }: { providers: ProviderMap }) {
  const router = useRouter();
  const callbackUrl = (router.query.callbackUrl as string) || "/tools";
  const errorParam = router.query.error as string | undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthProviders = useMemo(() => {
    if (!providers) return [];
    return Object.values(providers).filter((p) => p.type === "oauth");
  }, [providers]);

  function prettyError(code?: string) {
    // Common NextAuth errors: https://next-auth.js.org/errors
    if (!code) return null;
    if (code === "CredentialsSignin") return "Invalid email/password, or the account isn’t verified yet.";
    if (code === "AccessDenied") return "Access denied.";
    if (code === "Configuration") return "Auth configuration error. Please try again later.";
    return "Sign-in failed. Please try again.";
  }

  async function onPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) {
      setLoading(false);
      setError("Please enter your email and password.");
      return;
    }

    const res = await signIn("credentials", {
      redirect: false,
      email: em,
      password: pw,
      callbackUrl,
    });

    // signIn can return null on hard navigation; treat as failure
    if (!res) {
      setLoading(false);
      setError("Sign-in failed. Please try again.");
      return;
    }

    if (res.error) {
      setLoading(false);
      setError(prettyError(res.error) || "Sign-in failed.");
      return;
    }

    // Success
    router.push(res.url || callbackUrl);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4 py-14">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-extrabold">Sign in</h1>
        <p className="mt-2 text-neutral-600">
          Access the prompt library and tools. Use your password (or Google/GitHub if enabled).
        </p>

        {(error || errorParam) && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error || prettyError(errorParam)}
          </div>
        )}

        {/* Password login */}
        <div className="mt-8">
          <h2 className="text-lg font-bold">Password login</h2>

          <form className="mt-4 space-y-4" onSubmit={onPasswordLogin}>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link className="underline text-neutral-700 hover:text-black" href="/auth/forgot-password">
                Forgot password?
              </Link>
              <Link className="underline text-neutral-700 hover:text-black" href="/auth/signup">
                Create account
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="text-xs text-neutral-500">
              Password accounts may require email verification before they can sign in.
            </p>
          </form>
        </div>

        {/* OAuth */}
        {!!oauthProviders.length && (
          <div className="mt-10 pt-8 border-t border-neutral-200">
            <h2 className="text-lg font-bold">Or continue with</h2>
            <div className="mt-4 grid gap-3">
              {oauthProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => signIn(p.id, { callbackUrl })}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-xs text-neutral-500">
          <Link className="underline hover:text-black" href="/">
            Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const providers = await getProviders();
  return { props: { providers } };
};
