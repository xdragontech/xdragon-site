import React, { useEffect, useMemo, useState } from "react";
import { signIn, getCsrfToken } from "next-auth/react";
import { useRouter } from "next/router";

/**
 * Sign-in page (Pages Router)
 * - Credentials (email + password) login
 * - Shows explicit errors (no silent loop)
 * - Optional debug panel: add ?debug=1 to URL
 *
 * If you still get redirected back here with no error, it's usually ONE of:
 * 1) cookie/domain mismatch (www vs apex) -> fix by using one canonical domain + NEXTAUTH_URL
 * 2) authorize() returns null but you never see query error -> this page shows both res.error and ?error=
 */

function normalizeCallbackUrl(input: unknown): string {
  if (typeof input === "string" && input.startsWith("/")) return input;
  return "/tools";
}

function prettyAuthError(code: unknown): string | null {
  if (!code) return null;
  const c = Array.isArray(code) ? code[0] : String(code);

  // NextAuth common errors
  if (c === "CredentialsSignin") return "Invalid email or password.";
  if (c === "AccessDenied") return "Access denied. Your account may be blocked or not verified yet.";
  if (c === "Verification") return "Verification failed. Please request a new verification email.";
  if (c === "OAuthSignin") return "OAuth sign-in failed. Please try again.";
  if (c === "OAuthCallback") return "OAuth callback failed. Please try again.";
  if (c === "EmailSignin") return "Email sign-in failed. Please try again.";
  if (c === "SessionRequired") return "Please sign in to continue.";

  return `Sign-in failed (${c}).`;
}

type DebugState = {
  when: string;
  inputEmail?: string;
  callbackUrl?: string;
  result?: any;
  location?: string;
  cookiesHint?: string;
};

export default function SignInPage({ csrfToken }: { csrfToken?: string }) {
  const router = useRouter();

  const debugEnabled = useMemo(() => {
    const d = router.query.debug;
    return d === "1" || d === "true";
  }, [router.query.debug]);

  const callbackUrl = useMemo(
    () => normalizeCallbackUrl(router.query.callbackUrl),
    [router.query.callbackUrl]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debug, setDebug] = useState<DebugState | null>(null);

  // Surface NextAuth error passed via query string (happens when something redirects here)
  useEffect(() => {
    const qErr = router.query.error;
    const msg = prettyAuthError(qErr);
    if (msg) setError(msg);
  }, [router.query.error]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: trimmedEmail,
        password: trimmedPass,
        callbackUrl,
      });

      if (debugEnabled) {
        // Small cookie sanity hint (can't read HttpOnly cookies, but we can hint about hostname)
        const host = typeof window !== "undefined" ? window.location.host : "";
        const cookiesHint =
          host.includes("www.") ? "You are on www.* domain." : "You are on apex domain (no www).";
        setDebug({
          when: new Date().toISOString(),
          inputEmail: trimmedEmail,
          callbackUrl,
          result: res,
          location: typeof window !== "undefined" ? window.location.href : "",
          cookiesHint,
        });
      }

      // res can be null/undefined if NextAuth failed hard
      if (!res) {
        setError("Sign-in failed (no response). Check NEXTAUTH_URL / NEXTAUTH_SECRET in Vercel.");
        return;
      }

      if (res.error) {
        const msg = prettyAuthError(res.error) || "Sign-in failed. Please try again.";
        setError(msg);
        return;
      }

      if (!res.ok) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      // Success — navigate to callbackUrl
      await router.push(res.url || callbackUrl);
    } catch (err: any) {
      setError("Unexpected error during sign-in. Please try again.");
      if (debugEnabled) {
        setDebug({
          when: new Date().toISOString(),
          inputEmail: email,
          callbackUrl,
          result: { thrown: String(err?.message || err) },
          location: typeof window !== "undefined" ? window.location.href : "",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="X Dragon logo" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-bold">Sign in</h1>
            <p className="text-sm text-neutral-600">Access the Prompt Library and Tools.</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {/* NextAuth CSRF token for credentials provider */}
          <input name="csrfToken" type="hidden" defaultValue={csrfToken} />

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="you@company.com"
              autoComplete="email"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="••••••••"
              autoComplete="current-password"
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

        {debugEnabled && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-semibold text-neutral-700">Debug</div>
            <pre className="mt-2 overflow-auto text-xs text-neutral-800 whitespace-pre-wrap break-words">
              {JSON.stringify(debug, null, 2)}
            </pre>
            <p className="mt-2 text-xs text-neutral-600">
              If you see you’re on apex vs www inconsistently across pages/emails, fix by setting a single canonical
              domain and setting NEXTAUTH_URL to that domain in Vercel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx: any) {
  // CSRF token is required for credentials POST (even if we call signIn() client-side)
  const csrfToken = await getCsrfToken(ctx);
  return { props: { csrfToken } };
}
