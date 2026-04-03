import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PortalShell from "./PortalShell";
import { PORTAL_CONFIG } from "./portalConfig";
import type { CommandPartnerPortalScope } from "../../lib/commandPublicApi";

export default function PortalSignInPage(props: { scope: CommandPartnerPortalScope }) {
  const config = PORTAL_CONFIG[props.scope];
  const router = useRouter();
  const callbackUrl = useMemo(() => {
    const value = router.query.callbackUrl;
    const raw = Array.isArray(value) ? value[0] : value;
    return raw || `/${props.scope}/profile`;
  }, [props.scope, router.query.callbackUrl]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = router.query.error;
    const code = Array.isArray(value) ? value[0] : value;
    if (code === "SessionExpired") {
      setError("Your portal session expired. Please sign in again.");
    }
  }, [router.query.error]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/bff/${props.scope}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Sign-in failed. Please try again.");
      }

      window.location.assign(callbackUrl);
    } catch (nextError: any) {
      setError(nextError?.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title={config.signinHeading} subtitle={config.signinDescription}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-sm text-neutral-600">
          Need an account?{" "}
          <Link href={`/${props.scope}/signup`} className="font-semibold underline">
            {config.signupLinkLabel}
          </Link>
        </p>
      </form>
    </PortalShell>
  );
}
