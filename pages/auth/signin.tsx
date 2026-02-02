import { useEffect, useMemo, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/router";

type ProviderKey = "credentials";

function prettyAuthError(code?: string | string[] | null) {
  const c = Array.isArray(code) ? code[0] : code;
  if (!c) return null;
  const map: Record<string, string> = {
    CredentialsSignin: "Incorrect email or password.",
    AccessDenied: "Access denied. Your account may be blocked or not verified yet.",
    Configuration: "Auth is misconfigured. Please contact support.",
    Verification: "Your verification link is invalid or expired.",
    OAuthSignin: "OAuth sign-in failed. Please try again.",
    OAuthCallback: "OAuth callback failed. Please try again.",
  };
  return map[c] || `Sign-in failed (${c}).`;
}

export default function SignInPage() {
  const router = useRouter();
  const debug = router.query.debug === "1";

  const callbackUrl = useMemo(() => {
    // Prefer explicit callbackUrl from query, otherwise default to /tools
    const q = router.query.callbackUrl;
    return (Array.isArray(q) ? q[0] : q) || "/tools";
  }, [router.query.callbackUrl]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // If NextAuth redirects back with ?error=..., show it.
  useEffect(() => {
    const qErr = router.query.error;
    const msg = prettyAuthError(qErr) || null;
    if (msg) setError(msg);
  }, [router.query.error]);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const em = email.trim().toLowerCase();
    const pw = password.trim();

    if (!em || !pw) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const res = await signIn("credentials" as ProviderKey, {
        redirect: false,
        email: em,
        password: pw,
        callbackUrl,
      });

      if (debug) {
        setDebugInfo({
          when: new Date().toISOString(),
          inputEmail: em,
          callbackUrl,
          result: res,
          location: window.location.href,
          cookiesHint: "You are on www.* domain.",
        });
      }

      if (!res?.ok) {
        setError(prettyAuthError(res?.error) || "Sign-in failed. Please try again.");
        return;
      }

      // IMPORTANT: If signIn() says OK but your app immediately redirects back to /auth/signin,
      // it usually means the session cookie did not persist (domain mismatch: xdragon.tech vs www.xdragon.tech)
      // or NEXTAUTH_URL is not set correctly.
      const sess = await getSession();
      if (!sess?.user?.email) {
        setError(
          "Signed in, but your session was not established. This is usually a domain/cookie mismatch. " +
            "Make sure you always use ONE domain (recommend: https://www.xdragon.tech) and set NEXTAUTH_URL to it in Vercel."
        );
        return;
      }

      // Force a full navigation (safer than router.push for cookie propagation in edge cases)
      const target = res.url || callbackUrl;
      window.location.assign(target);
    } catch (err: any) {
      setError(err?.message || "Unexpected error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-neutral-600">Access the prompt library and tools.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handlePasswordSignIn} className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
          />

          <label className="mt-4 block text-sm font-medium">Password</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-4 flex items-center justify-between text-sm">
            <a href="/auth/forgot-password" className="underline">
              Forgot password?
            </a>
            <a href="/auth/signup" className="underline">
              Create account
            </a>
          </div>
        </form>

        {debug && (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4 text-xs overflow-auto">
            <div className="font-semibold mb-2">Debug</div>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            <div className="mt-3 text-neutral-600">
              If this says ok=true but you still get bounced back to /auth/signin, fix canonical domain + NEXTAUTH_URL.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
