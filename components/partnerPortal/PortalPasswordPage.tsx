import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import PortalShell from "./PortalShell";
import { PORTAL_CONFIG } from "./portalConfig";
import type { CommandPartnerPortalAccount, CommandPartnerPortalScope } from "../../lib/commandPublicApi";

export default function PortalPasswordPage(props: {
  scope: CommandPartnerPortalScope;
  account: CommandPartnerPortalAccount;
}) {
  const router = useRouter();
  const config = PORTAL_CONFIG[props.scope];
  const callbackUrl = useMemo(() => {
    const value = router.query.callbackUrl;
    const raw = Array.isArray(value) ? value[0] : value;
    return raw || `/${props.scope}/profile`;
  }, [props.scope, router.query.callbackUrl]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/bff/${props.scope}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to update password.");
      }

      window.location.assign(callbackUrl);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell
      title={`${config.title} Password Update`}
      subtitle={`Set a new password for ${props.account.email} before continuing to the portal.`}
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The current password was issued by backoffice. You must choose a new password before continuing.
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
    </PortalShell>
  );
}
