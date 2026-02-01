// pages/auth/signin.tsx
import React, { useMemo, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import type { GetServerSideProps } from "next";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

type Props = {
  providers: ProviderMap;
};

export default function SignIn({ providers }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const emailProvider = useMemo(() => providers?.email, [providers]);
  const google = useMemo(() => providers?.google, [providers]);
  const github = useMemo(() => providers?.github, [providers]);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMsg("Please enter your email address.");
      return;
    }

    try {
      setStatus("sending");
      // For EmailProvider, NextAuth requires an email parameter.
      await signIn("email", {
        email: trimmed,
        callbackUrl: "/tools",
        redirect: true,
      });
      // Usually redirects away; fallback if it doesn't.
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Could not send the magic link. Please try again.");
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

        <div className="mt-6 space-y-4">
          {emailProvider && (
            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send Magic Link"}
              </button>

              {status === "sent" && (
                <p className="text-sm text-emerald-700">
                  If this email exists, you’ll receive a sign-in link shortly.
                </p>
              )}
              {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
            </form>
          )}

          {(google || github) && (
            <div className="grid grid-cols-2 gap-3">
              {google && (
                <button
                  type="button"
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn("google", { callbackUrl: "/tools" })}
                >
                  Google
                </button>
              )}
              {github && (
                <button
                  type="button"
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                  onClick={() => signIn("github", { callbackUrl: "/tools" })}
                >
                  GitHub
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-neutral-500">
            By continuing, you agree to receive a sign-in email if you use Magic Link.
          </p>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const providers = await getProviders();
  return { props: { providers } };
};
