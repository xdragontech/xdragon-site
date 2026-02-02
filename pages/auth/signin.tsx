// pages/auth/signin.tsx
import React, { useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { getCsrfToken, getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/router";

type Props = {
  csrfToken: string | null;
  providers: Record<string, any> | null;
};

function prettyAuthError(code?: string | string[]) {
  const c = Array.isArray(code) ? code[0] : code;
  if (!c) return null;
  // Common NextAuth error codes
  const map: Record<string, string> = {
    CredentialsSignin: "Email or password was incorrect.",
    OAuthAccountNotLinked: "That email is already linked to a different sign-in method.",
    AccessDenied: "Access denied. Your account may be blocked or not verified yet.",
    Verification: "The sign-in link is invalid or expired.",
    Configuration: "Auth is misconfigured. Please contact support.",
    Default: "Sign-in failed. Please try again.",
  };
  return map[c] || map.Default;
}

export default function SignInPage({ csrfToken, providers }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(() => {
    const q = router.query.callbackUrl;
    const url = (Array.isArray(q) ? q[0] : q) || "/tools";
    return url;
  }, [router.query.callbackUrl]);

  // If NextAuth redirected back here with an error, surface it.
  React.useEffect(() => {
    const msg = prettyAuthError(router.query.error);
    if (msg) setError(msg);
  }, [router.query.error]);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const e1 = email.trim().toLowerCase();
    const p1 = password.trim();

    if (!e1 || !p1) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      // IMPORTANT: redirect:false prevents silent loops back to /auth/signin.
      const res = await signIn("credentials", {
        redirect: false,
        email: e1,
        password: p1,
        callbackUrl,
      });

      // res can be undefined if something throws very early
      if (!res) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      if (res.ok) {
        // res.url is usually the callbackUrl; be defensive.
        await router.push(res.url || callbackUrl);
        return;
      }

      // If NextAuth returned an error code, show a friendly message.
      const msg = prettyAuthError(res.error) || "Sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const oauthProviders = useMemo(() => {
    if (!providers) return [];
    return Object.values(providers).filter((p: any) => p?.type === "oauth");
  }, [providers]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-16">
        <a href="/" className="inline-flex items-center gap-2 font-semibold text-lg">
          <img src="/logo.png" alt="X Dragon Technologies logo" className="h-9 w-auto" />
          <span>Tools</span>
        </a>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-neutral-600">Access the Prompt Library and tools.</p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onPasswordSubmit}>
            {/* csrfToken isn't required for signIn("credentials"), but harmless if you also post to NextAuth form endpoints */}
            {csrfToken ? <input name="csrfToken" type="hidden" defaultValue={csrfToken} /> : null}

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <a className="underline text-neutral-700 hover:text-black" href="/auth/forgot-password">
                Forgot password?
              </a>
              <a className="underline text-neutral-700 hover:text-black" href="/auth/signup">
                Create account
              </a>
            </div>
          </form>

          {oauthProviders.length > 0 && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs text-neutral-500">OR</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              <div className="grid gap-3">
                {oauthProviders.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => signIn(p.id, { callbackUrl })}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                    type="button"
                    disabled={busy}
                  >
                    Continue with {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-neutral-500">
          Tip: If sign-in loops back here, open DevTools → Network and check the response from{" "}
          <code className="px-1">/api/auth/callback/credentials</code>. If it redirects back with{" "}
          <code className="px-1">?error=CredentialsSignin</code>, it’s a bad password or unverified/blocked account.
        </p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const [csrfToken, providers] = await Promise.all([getCsrfToken(ctx), getProviders()]);
  return { props: { csrfToken: csrfToken ?? null, providers: (providers as any) ?? null } };
};
