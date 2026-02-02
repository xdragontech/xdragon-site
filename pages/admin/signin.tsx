// pages/admin/signin.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { authOptions } from "../api/auth/[...nextauth]";

function prettyAuthError(err?: string | null): string | null {
  if (!err) return null;

  // NextAuth can return codes like "CredentialsSignin" in the URL query.
  const map: Record<string, string> = {
    CredentialsSignin: "Invalid email or password.",
    AccessDenied: "Access denied.",
    Configuration: "Auth configuration error. Please contact support.",
    Verification: "Verification failed. Please try again.",
  };

  return map[err] || err;
}

export default function AdminCommandSignIn() {
  const router = useRouter();
  const callbackUrl = useMemo(() => {
    const q = router.query.callbackUrl;
    return typeof q === "string" && q ? q : "/admin/users";
  }, [router.query.callbackUrl]);

  const initialErr = useMemo(() => {
    const q = router.query.error;
    return typeof q === "string" ? prettyAuthError(q) : null;
  }, [router.query.error]);

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
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: e2,
        password: p2,
        callbackUrl,
      });

      if (!res) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      if (res.ok && res.url) {
        // Important: do a hard navigation so cookies/session are applied cleanly.
        window.location.href = res.url;
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
      </Head>

      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-lg px-4 py-16">
          {/* Brand */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <img src="/logo.png" alt="X Dragon Technologies logo" className="h-11 w-auto" />
            <div className="leading-tight">
              <div className="text-xl font-semibold text-neutral-900">Command</div>
              <div className="text-sm text-neutral-600">Admin access</div>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-neutral-600">Use your admin credentials to manage users.</p>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Email</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@xdragon.tech"
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
              (recommended: <span className="font-medium">https://www.xdragon.tech</span>) and that
              <span className="font-medium"> NEXTAUTH_URL</span> matches it in Vercel.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // If already authed, go to admin page.
  if (session?.user) {
    return {
      redirect: {
        destination: "/admin/users",
        permanent: false,
      },
    };
  }

  return { props: {} };
};
