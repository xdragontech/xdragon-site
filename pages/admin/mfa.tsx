import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { authOptions } from "../api/auth/[...nextauth]";
import { isBackofficeSession, requiresBackofficeMfaChallenge } from "../../lib/authScopes";
import {
  hasVerifiedBackofficeMfaForRequest,
  resolveBackofficePostAuthDestination,
} from "../../lib/backofficeAuth";
import { getRuntimeHostConfig } from "../../lib/runtimeHostConfig";
import { getApiRequestHost } from "../../lib/requestHost";

type BackofficeMfaPageProps = {
  callbackUrl: string;
  username: string;
  allowedHosts: string[];
  recommendedAdminHost: string | null;
};

function normalizeCallbackUrl(raw: string | string[] | undefined, currentOrigin: string, allowedHosts: string[]): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const fallback = "/admin/library";
  if (!value) return fallback;

  try {
    if (value.startsWith("/")) return value;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (allowedHosts.includes(host)) {
      return `${currentOrigin}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {}

  return fallback;
}

export const getServerSideProps: GetServerSideProps<BackofficeMfaPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const runtimeHost = await getRuntimeHostConfig(getApiRequestHost(ctx.req));
  const callbackUrl = typeof ctx.query.callbackUrl === "string" ? ctx.query.callbackUrl : null;
  if (!isBackofficeSession(session)) {
    return {
      redirect: {
        destination: `/admin/signin?callbackUrl=${encodeURIComponent(callbackUrl || "/admin/library")}`,
        permanent: false,
      },
    };
  }

  const destination = callbackUrl || resolveBackofficePostAuthDestination(session);
  if (!requiresBackofficeMfaChallenge(session)) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  if (hasVerifiedBackofficeMfaForRequest(ctx.req, session)) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  return {
    props: {
      callbackUrl: destination,
      username:
        String((session as any)?.user?.email || (session as any)?.user?.username || (session as any)?.user?.name || "staff"),
      allowedHosts: runtimeHost.allowedHosts,
      recommendedAdminHost: runtimeHost.canonicalAdminHost,
    },
  };
};

export default function AdminMfaChallengePage({
  callbackUrl: initialCallbackUrl,
  username,
  allowedHosts,
  recommendedAdminHost,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return initialCallbackUrl;
    return normalizeCallbackUrl((router.query.callbackUrl as any) || initialCallbackUrl, window.location.origin, allowedHosts);
  }, [allowedHosts, initialCallbackUrl, router.query.callbackUrl]);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const input = code.trim();
    if (!input) {
      setError("Enter your 6-digit authenticator code or a recovery code.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/mfa/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: input }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || "MFA verification failed");
      }

      if (body?.result?.usedRecoveryCode) {
        setSuccess("Recovery code accepted. You have been signed in.");
      } else {
        setSuccess("Authenticator verified. You have been signed in.");
      }

      window.location.assign(callbackUrl || "/admin/library");
    } catch (nextError: any) {
      setError(nextError?.message || "MFA verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>X Dragon Command — Verify Sign In</title>
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
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
              <div className="text-sm text-neutral-600">Verify sign in</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Authenticator Check</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Enter the 6-digit code from your authenticator app, or use a recovery code for <span className="font-medium">{username}</span>.
            </p>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {!error && success ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {success}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Authenticator or recovery code</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="text"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456 or ABCD-EFGH-IJKL"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify Sign In"}
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
              Use the same admin host throughout sign-in and verification.
              Recommended: <span className="font-medium">{" https://" + (recommendedAdminHost || "your-admin-host")}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
