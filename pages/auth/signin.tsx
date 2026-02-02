// pages/auth/signin.tsx
import React, { useMemo, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

type Props = {
  providers: Awaited<ReturnType<typeof getProviders>>;
};

function asString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function SignIn({ providers }: Props) {
  const router = useRouter();

  const callbackUrl = useMemo(() => {
    const q = asString(router.query.callbackUrl);
    // Keep it relative for safety; default to the tools landing page.
    if (!q) return "/tools";
    try {
      // If someone passes a full URL, only allow same-origin paths.
      const url = new URL(q, "https://www.xdragon.tech");
      return url.pathname + url.search + url.hash;
    } catch {
      return "/tools";
    }
  }, [router.query.callbackUrl]);

  const nextAuthError = asString(router.query.error);
  const verified = asString(router.query.verified);

  const emailProvider = providers && Object.values(providers).find((p) => p.id === "email");
  const google = providers && Object.values(providers).find((p) => p.id === "google");
  const github = providers && Object.values(providers).find((p) => p.id === "github");

  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [uiError, setUiError] = useState<string | null>(null);

  const errorMessage = useMemo(() => {
    if (uiError) return uiError;
    if (!nextAuthError) return null;

    // Map common NextAuth errors to something human-friendly
    switch (nextAuthError) {
      case "CredentialsSignin":
        return "That email/password didn’t work. If you just signed up, make sure you verified your email first.";
      case "EmailSignin":
        return "We couldn’t send the magic link. Double-check your email address and try again.";
      case "OAuthSignin":
      case "OAuthCallback":
        return "Sign-in failed. Please try again.";
      default:
        return "Sign-in failed. Please try again.";
    }
  }, [nextAuthError, uiError]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setUiError(null);
    setMagicSent(false);

    const email = magicEmail.trim();
    if (!email) {
      setUiError("Please enter your email address.");
      return;
    }

    if (!emailProvider) {
      setUiError("Email sign-in isn’t available right now.");
      return;
    }

    setMagicBusy(true);
    try {
      const res = await signIn(emailProvider.id, {
        email,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setUiError("We couldn’t send the magic link. Please try again.");
      } else {
        setMagicSent(true);
      }
    } catch (err) {
      setUiError("We couldn’t send the magic link. Please try again.");
    } finally {
      setMagicBusy(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setUiError(null);

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      setUiError("Please enter your email and password.");
      return;
    }

    setLoginBusy(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl,
        email,
        password,
      });

      if (res?.error) {
        setUiError("That email/password didn’t work. If you just signed up, verify your email first.");
        return;
      }

      // Successful sign-in
      await router.push(res?.url || callbackUrl);
    } catch (err) {
      setUiError("Sign-in failed. Please try again.");
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white shadow-sm p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-black text-white grid place-items-center font-bold">XD</div>
          <div>
            <div className="text-lg font-semibold">X Dragon Tools</div>
            <div className="text-sm text-neutral-600">Sign in to access the Prompt Library.</div>
          </div>
        </div>

        {(verified === "1" || verified === "true") && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Email verified — you can log in now.
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {errorMessage}
          </div>
        )}

        {/* Email + Password */}
        <div className="mt-6">
          <div className="text-sm font-semibold">Email + Password</div>
          <form className="mt-3 space-y-3" onSubmit={handlePasswordLogin}>
            <div>
              <label className="text-xs font-medium text-neutral-600">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loginBusy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-3 text-xs text-neutral-600">
            New here?{" "}
            <a href="/auth/signup" className="font-semibold underline">
              Create an account
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <div className="text-xs text-neutral-500">or</div>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* Magic Link */}
        <div>
          <div className="text-sm font-semibold">Magic Link</div>
          <form className="mt-3 space-y-3" onSubmit={handleMagicLink}>
            <div>
              <label className="text-xs font-medium text-neutral-600">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <button
              type="submit"
              disabled={magicBusy || !emailProvider}
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
            >
              {magicBusy ? "Sending…" : "Send magic link"}
            </button>

            {magicSent && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
                Check your inbox — we sent you a sign-in link.
              </div>
            )}
          </form>

          <p className="mt-3 text-xs text-neutral-500">
            By continuing, you agree to receive a sign-in email if you choose Magic Link.
          </p>
        </div>

        {/* OAuth buttons */}
        {(google || github) && (
          <div className="mt-6 space-y-3">
            <div className="text-sm font-semibold">Or continue with</div>
            <div className="grid grid-cols-2 gap-3">
              {google && (
                <button
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn(google.id, { callbackUrl })}
                >
                  Google
                </button>
              )}
              {github && (
                <button
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn(github.id, { callbackUrl })}
                >
                  GitHub
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const providers = await getProviders();
  return { props: { providers } };
};
