// pages/auth/signin.tsx
import React, { useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getCsrfToken, getProviders, signIn } from "next-auth/react";

type Providers = Awaited<ReturnType<typeof getProviders>>;

type Props = {
  providers: Providers;
  csrfToken: string | null;
  oauthEnabled: {
    google: boolean;
    github: boolean;
  };
};

function safeCallbackUrl(raw: unknown): string {
  // Only allow relative callback URLs to prevent open-redirects.
  if (typeof raw !== "string") return "/tools";
  if (raw.startsWith("/")) return raw;
  return "/tools";
}

export default function SignIn({ providers, csrfToken, oauthEnabled }: Props) {
  const router = useRouter();

  const callbackUrl = safeCallbackUrl(
    Array.isArray(router.query.callbackUrl) ? router.query.callbackUrl[0] : router.query.callbackUrl
  );

  const providerList = useMemo(() => Object.values(providers || {}), [providers]);
  const emailProvider = providerList.find((p) => p.id === "email");
  const credentialsProvider = providerList.find((p) => p.id === "credentials");
  const oauthProviders = providerList.filter((p) => p.type === "oauth");

  const [magicEmail, setMagicEmail] = useState("");
  const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent">("idle");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "signing">("idle");

  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = magicEmail.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setMagicStatus("sending");

    try {
      // redirect:false lets us show an in-page confirmation
      const res = await signIn("email", {
        email: trimmed,
        callbackUrl,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setMagicStatus("idle");
        return;
      }

      setMagicStatus("sent");
    } catch (err) {
      console.error("Magic link sign-in error", err);
      setError("Something went wrong sending the magic link.");
      setMagicStatus("idle");
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailNorm = email.trim().toLowerCase();
    const pass = password.trim();

    if (!emailNorm || !pass) {
      setError("Please enter both email and password.");
      return;
    }

    setLoginStatus("signing");

    // Prevent “stuck on Signing in…” if the network request hangs.
    const TIMEOUT_MS = 15000;

    try {
      const res = await Promise.race([
        signIn("credentials", {
          redirect: false,
          email,
          password: pass,
          callbackUrl,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Sign-in timed out. Please try again.")), TIMEOUT_MS)),
      ]);

      // NextAuth can return undefined in edge cases (treat as failure)
      if (!res) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      if (res.error) {
        // Map common error codes to friendlier messages.
        const msg =
          res.error === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email first. Check your inbox for the verification link."
            : res.error === "CredentialsSignin"
              ? "Incorrect email or password."
              : res.error;

        setError(msg);
        return;
      }

      // Success: navigate. We also clear the loading state in case navigation is blocked or instant.
      await router.push(res.url || callbackUrl);
    } catch (err: any) {
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setLoginStatus("idle");
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Access the prompt library and tools. Use a magic link or your password.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Magic link */}
          {emailProvider ? (
            <form onSubmit={handleMagicLink} className="mt-6">
              <div className="text-sm font-semibold text-neutral-900">Email magic link</div>
              <div className="mt-2">
                <label className="text-sm font-medium text-neutral-700">Email</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="you@company.com"
                />
              </div>

              {/* csrfToken included for future-proofing / non-JS fallbacks */}
              <input type="hidden" name="csrfToken" value={csrfToken || ""} />
              <input type="hidden" name="callbackUrl" value={callbackUrl} />

              <button
                type="submit"
                disabled={magicStatus === "sending" || magicStatus === "sent"}
                className="mt-3 w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {magicStatus === "sent" ? "Link sent" : magicStatus === "sending" ? "Sending…" : "Send magic link"}
              </button>

              {magicStatus === "sent" && (
                <p className="mt-3 text-sm text-neutral-700">
                  Check your email for a sign-in link. You can close this tab.
                </p>
              )}
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              Magic link sign-in is not enabled.
            </div>
          )}

          {/* Password login */}
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <div className="text-sm font-semibold text-neutral-900">Password login</div>

            {credentialsProvider ? (
              <form onSubmit={handlePasswordLogin} className="mt-2">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Email</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium text-neutral-700">Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="••••••••"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <a href="/auth/forgot-password" className="text-sm font-medium text-neutral-700 hover:underline">
                    Forgot password?
                  </a>
                  <a href="/auth/signup" className="text-sm font-medium text-neutral-700 hover:underline">
                    Create account
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loginStatus === "signing"}
                  className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {loginStatus === "signing" ? "Signing in…" : "Sign in"}
                </button>

                <p className="mt-3 text-xs text-neutral-500">
                  Password accounts require email verification before they can sign in.
                </p>
              </form>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                Password login isn’t enabled yet.
              </p>
            )}
          </div>

          {/* OAuth */}
          {oauthProviders.length > 0 && (
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <div className="text-sm font-semibold text-neutral-900">Or continue with</div>
              <div className="mt-3 flex flex-col gap-2">
                {oauthProviders.map((p) => {
                  const enabled = p.id === "google" ? oauthEnabled.google : p.id === "github" ? oauthEnabled.github : true;
                  return (
                    <button
                      key={p.id}
                      onClick={() => enabled && signIn(p.id, { callbackUrl })}
                      disabled={!enabled}
                      className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
                      title={enabled ? undefined : "This provider is not configured yet."}
                      type="button"
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <a href="/" className="text-sm text-neutral-600 hover:underline">
              ← Back to home
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          By signing in you agree to our terms.
        </p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const [providers, csrfToken] = await Promise.all([getProviders(), getCsrfToken(ctx)]);

  return {
    props: {
      providers,
      csrfToken: csrfToken ?? null,
      oauthEnabled: {
        google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      },
    },
  };
};
