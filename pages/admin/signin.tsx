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
  // Common NextAuth error codes
  if (err === "CredentialsSignin") return "Incorrect email or password.";
  if (err === "AccessDenied") return "Access denied.";
  if (err === "Verification") return "Please verify your email before signing in.";
  if (err === "Configuration") return "Auth configuration error. Please contact support.";
  return "Sign-in failed. Please try again.";
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session?.user && (session as any).role === "ADMIN" && (session as any).status !== "BLOCKED") {
    return {
      redirect: { destination: "/admin/users", permanent: false },
    };
  }
  return { props: {} };
};

export default function AdminSignIn() {
  const router = useRouter();
  const callbackUrl = useMemo(() => {
    const q = router.query.callbackUrl;
    if (typeof q === "string" && q.trim()) return q;
    return "/admin/users";
  }, [router.query.callbackUrl]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
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
      const res = await signIn("credentials", {
        redirect: false,
        email: e1,
        password: p1,
        callbackUrl,
      });

      if (!res?.ok) {
        setError(prettyAuthError(res?.error) || "Sign-in failed. Please try again.");
        return;
      }

      // NextAuth returns a URL on success
      router.push(res.url || callbackUrl);
    } catch (err) {
      console.error(err);
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

      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-md px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="X Dragon Technologies" className="h-9 w-auto" />
            <div className="leading-tight">
              <div className="text-xl font-semibold">Command</div>
              <div className="text-sm text-neutral-300">Admin access</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-neutral-300">
              This login is for administrators only.
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="block text-sm font-medium text-neutral-200">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="you@xdragon.tech"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-200">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 text-xs text-neutral-400">
              Tip: If you get bounced back here after a successful sign-in, confirm you’re on{" "}
              <span className="text-neutral-200">https://www.xdragon.tech</span> and{" "}
              <span className="text-neutral-200">NEXTAUTH_URL</span> matches it.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
