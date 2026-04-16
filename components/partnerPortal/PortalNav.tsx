import Link from "next/link";
import type { CommandPartnerPortalScope } from "../../lib/commandPublicApi";

export default function PortalNav(props: {
  scope: CommandPartnerPortalScope;
  // HUMAN-REVIEW: Wave 12 — added "calendar" tab
  active: "profile" | "applications" | "calendar";
  displayName: string;
  onSignOut: () => Promise<void> | void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm font-medium text-neutral-900">{props.displayName}</div>
        <div className="text-xs text-neutral-600">Partner portal session</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/${props.scope}/profile`}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            props.active === "profile" ? "bg-black text-white" : "border border-neutral-300 text-neutral-800"
          }`}
        >
          Profile
        </Link>
        <Link
          href={`/${props.scope}/applications`}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            props.active === "applications" ? "bg-black text-white" : "border border-neutral-300 text-neutral-800"
          }`}
        >
          Applications
        </Link>
        {/* HUMAN-REVIEW: Wave 12 — calendar tab for availability management */}
        <Link
          href={`/${props.scope}/calendar`}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            props.active === "calendar" ? "bg-black text-white" : "border border-neutral-300 text-neutral-800"
          }`}
        >
          Calendar
        </Link>
        <button
          type="button"
          onClick={() => void props.onSignOut()}
          disabled={props.busy}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-60"
        >
          {props.busy ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
