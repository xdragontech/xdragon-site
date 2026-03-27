import type { GetServerSideProps } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { getSession, signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { authOptions } from "../api/auth/[...nextauth]";
import {
  BACKOFFICE_CREDENTIALS_PROVIDER_ID,
  isBackofficeSession,
  requiresBackofficeMfaChallenge,
} from "../../lib/authScopes";
import {
  hasVerifiedBackofficeMfaForRequest,
  resolveBackofficePostAuthDestination,
} from "../../lib/backofficeAuth";
import { getRuntimeHostConfig } from "../../lib/runtimeHostConfig";
import { getApiRequestHost } from "../../lib/requestHost";

type AdminSignInProps = {
  allowedHosts: string[];
  recommendedAdminHost: string | null;
};

function normalizeCallbackUrl(raw: string | string[] | undefined, currentOrigin: string, allowedHosts: string[]): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const fallback = "/admin/library";
  if (!v) return fallback;

  try {
    if (v.startsWith("/")) return v;
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    if (allowedHosts.includes(host)) {
      return `${currentOrigin}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {}
  return fallback;
}

function prettyAuthError(err?: string | null): string | null {
  if (!err) return null;
  const map: Record<string, string> = {
    CredentialsSignin: "Invalid email or password.",
    AccessDenied: "Access denied.",
    Configuration: "Auth configuration error. Please contact support.",
    Verification: "Verification failed. Please try again.",
  };
  return map[err] || err;
}

export default function AdminCommandSignIn({ allowedHosts, recommendedAdminHost }: AdminSignInProps) {
  const router = useRouter();

  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return "/admin/dashboard";
    return normalizeCallbackUrl(router.query.callbackUrl as any, window.location.origin, allowedHosts);
  }, [allowedHosts, router.query.callbackUrl]);

  const initialErr = useMemo(() => {
    const q = router.query.error;
    return typeof q === "string" ? prettyAuthError(q) : null;
  }, [router.query.error]);
  const resetNotice = useMemo(() => {
    return router.query.reset === "1"
      ? "Password updated. Sign in with your new backoffice password."
      : null;
  }, [router.query.reset]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialErr);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const e2 = email.trim().toLowerCase();
    const p2 = password.trim();
    if (!e2 || !p2) {
      setError("Please enter your email/username and password.");
      return;
    }

    setBusy(true);
    try {
      const res = await signIn(BACKOFFICE_CREDENTIALS_PROVIDER_ID, {
        redirect: false,
        email: e2,
        password: p2,
        callbackUrl,
      });

      if (!res) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      if (res.ok) {
        const session = await getSession();
        if (!isBackofficeSession(session)) {
          setError(
            "Signed in, but your admin session was not established. This is usually a cookie or canonical-domain mismatch. " +
              `Use https://${recommendedAdminHost || "your-admin-host"} and verify NEXTAUTH_URL plus host config in Vercel.`
          );
          return;
        }

        const target = callbackUrl || resolveBackofficePostAuthDestination(session);
        if (requiresBackofficeMfaChallenge(session)) {
          window.location.assign(`/admin/mfa?callbackUrl=${encodeURIComponent(target)}`);
          return;
        }

        window.location.assign(target);
        return;
      }

      const msg = prettyAuthError(res.error) || "Sign-in failed. Please try again.";
      setError(msg);
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>X Dragon Command — Sign in</title>
        <link rel="icon" type="image/png" href="/favicon_symbol.png?v=2" />
        <link rel="shortcut icon" href="/favicon_symbol.png?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
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
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-neutral-600">Use your admin credentials to manage users.</p>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {!error && resetNotice ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {resetNotice}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Username or email</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@xdragon.tech or grant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">Password</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
              Tip: if you get signed-in but bounced back here, double-check that you always use the same canonical domain
              (recommended: <span className="font-medium">{"https://" + (recommendedAdminHost || "your-admin-host")}</span>) and that
              <span className="font-medium"> NEXTAUTH_URL</span> matches it in Vercel.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminSignInProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const runtimeHost = await getRuntimeHostConfig(getApiRequestHost(ctx.req));
  if (isBackofficeSession(session)) {
    const destination = resolveBackofficePostAuthDestination(session);
    if (requiresBackofficeMfaChallenge(session) && !hasVerifiedBackofficeMfaForRequest(ctx.req, session)) {
      return {
        redirect: {
          destination: `/admin/mfa?callbackUrl=${encodeURIComponent(destination)}`,
          permanent: false,
        },
      };
    }

    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }
  return {
    props: {
      allowedHosts: runtimeHost.allowedHosts,
      recommendedAdminHost: runtimeHost.canonicalAdminHost,
    },
  };
};
