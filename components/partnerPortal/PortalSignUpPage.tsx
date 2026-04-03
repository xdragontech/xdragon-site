import { useState } from "react";
import Link from "next/link";
import PortalShell from "./PortalShell";
import { PORTAL_CONFIG } from "./portalConfig";
import type { CommandPartnerPortalScope, CommandPartnerParticipantType } from "../../lib/commandPublicApi";

const participantTypeOptions: Array<{ value: CommandPartnerParticipantType; label: string }> = [
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "FOOD_VENDOR", label: "Food Vendor" },
  { value: "MARKET_VENDOR", label: "Market Vendor" },
];

export default function PortalSignUpPage(props: { scope: CommandPartnerPortalScope }) {
  const config = PORTAL_CONFIG[props.scope];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [participantType, setParticipantType] = useState<CommandPartnerParticipantType>("ENTERTAINMENT");
  const [productServiceType, setProductServiceType] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim() || !displayName.trim() || !contactName.trim() || !contactPhone.trim()) {
      setError("Please complete the required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (props.scope === "sponsors" && !productServiceType.trim()) {
      setError("Product or service type is required.");
      return;
    }

    setBusy(true);
    try {
      const body =
        props.scope === "partners"
          ? {
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim(),
              contactName: contactName.trim(),
              contactPhone: contactPhone.trim(),
              summary: summary.trim() || null,
              participantType,
            }
          : {
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim(),
              contactName: contactName.trim(),
              contactPhone: contactPhone.trim(),
              productServiceType: productServiceType.trim(),
            };

      const response = await fetch(`/api/bff/${props.scope}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not create account.");
      }
      setSent(true);
    } catch (nextError: any) {
      setError(nextError?.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title={config.signupHeading} subtitle={config.signupDescription}>
      {sent ? (
        <div className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-semibold text-neutral-900">Check your inbox</div>
          <p className="text-sm text-neutral-700">
            We sent a verification link to <span className="font-semibold">{email.trim()}</span>. Verify your email to
            activate the portal account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${props.scope}/signin`} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
              {config.signinLinkLabel}
            </Link>
            <Link href="/" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800">
              Back to site
            </Link>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={onSubmit}>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <div>
            <label className="text-sm font-medium">{config.brandNameLabel}</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={props.scope === "partners" ? "Friday Stage Band" : "Brand name"}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contact name</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Primary contact"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contact phone</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="604-555-1234"
            />
          </div>
          {props.scope === "partners" ? (
            <>
              <div>
                <label className="text-sm font-medium">Participant type</label>
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  value={participantType}
                  onChange={(event) => setParticipantType(event.target.value as CommandPartnerParticipantType)}
                >
                  {participantTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Summary</label>
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Short overview of the participant partner"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-sm font-medium">Product or service type</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={productServiceType}
                onChange={(event) => setProductServiceType(event.target.value)}
                placeholder="Product or service type"
              />
            </div>
          )}
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
              placeholder="At least 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating..." : config.signupLinkLabel}
          </button>
          <p className="text-sm text-neutral-600">
            Already have an account?{" "}
            <Link href={`/${props.scope}/signin`} className="font-semibold underline">
              {config.signinLinkLabel}
            </Link>
          </p>
        </form>
      )}
    </PortalShell>
  );
}
