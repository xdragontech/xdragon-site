import { useEffect, useMemo, useState } from "react";
import type {
  CommandPartnerPortalAccount,
  CommandPartnerPortalApplication,
  CommandPartnerPortalEventOption,
  CommandPartnerPortalScope,
} from "../../lib/commandPublicApi";
import PortalShell from "./PortalShell";
import PortalNav from "./PortalNav";
import { PORTAL_CONFIG } from "./portalConfig";

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "IN_REVIEW") return "bg-amber-100 text-amber-800";
  if (status === "SUBMITTED") return "bg-blue-100 text-blue-800";
  return "bg-neutral-100 text-neutral-700";
}

export default function PortalApplicationsPage(props: {
  scope: CommandPartnerPortalScope;
  account: CommandPartnerPortalAccount;
}) {
  const config = PORTAL_CONFIG[props.scope];
  const [applications, setApplications] = useState<CommandPartnerPortalApplication[]>([]);
  const [availableEvents, setAvailableEvents] = useState<CommandPartnerPortalEventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/${props.scope}/applications`);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load applications.");
      }
      setApplications((payload.applications || []) as CommandPartnerPortalApplication[]);
      setAvailableEvents((payload.availableEvents || []) as CommandPartnerPortalEventOption[]);
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [props.scope]);

  const blockedEventIds = useMemo(() => {
    return new Set(
      applications
        .filter((application) => ["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(application.status))
        .map((application) => application.event.id)
    );
  }, [applications]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch(`/api/bff/${props.scope}/auth/logout`, { method: "POST" });
    } finally {
      window.location.assign(`/${props.scope}/signin`);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedEventId) {
      setError("Please select an event.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/bff/${props.scope}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleEventSeriesId: selectedEventId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to submit application.");
      }
      setSelectedEventId("");
      setNotice("Application submitted.");
      await load();
    } catch (nextError: any) {
      setError(nextError?.message || "Failed to submit application.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title={config.applicationsHeading} subtitle={config.subtitle} width="wide">
      <div className="grid gap-6">
        <PortalNav
          scope={props.scope}
          active="applications"
          displayName={props.account.displayName}
          onSignOut={handleSignOut}
          busy={signingOut}
        />

        {loading ? <div className="text-sm text-neutral-600">Loading applications...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

        <form className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Active event</label>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Select an event</option>
              {availableEvents.map((event) => (
                <option key={event.id} value={event.id} disabled={blockedEventIds.has(event.id)}>
                  {event.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-neutral-600">
              All active events in the current brand are available in v1. Existing submitted, in-review, or approved
              applications for the same event cannot be duplicated.
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Submitting..." : config.applicationCtaLabel}
          </button>
        </form>

        <div className="grid gap-3">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              No applications submitted yet.
            </div>
          ) : (
            applications.map((application) => (
              <div key={application.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="grid gap-1">
                    <div className="text-base font-semibold text-neutral-900">{application.event.name}</div>
                    <div className="text-sm text-neutral-600">
                      {new Date(application.event.seasonStartsOn).toLocaleDateString()} -{" "}
                      {new Date(application.event.seasonEndsOn).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                    {application.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}
