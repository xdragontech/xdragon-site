// HUMAN-REVIEW: Wave 12 — partner availability calendar component
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CommandPartnerAvailabilityEntry,
  CommandPartnerPortalAccount,
  CommandPartnerPortalApplication,
  CommandPartnerPortalEventOption,
  CommandPartnerPortalScope,
} from "../../lib/commandPublicApi";
import PortalNav from "./PortalNav";
import PortalShell from "./PortalShell";

// Dynamically import FullCalendar to avoid SSR issues
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false }) as any;

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "IN_REVIEW") return "bg-amber-100 text-amber-800";
  if (status === "SUBMITTED") return "bg-blue-100 text-blue-800";
  return "bg-neutral-100 text-neutral-700";
}

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  display: string;
  backgroundColor: string;
  borderColor: string;
};

export default function PortalCalendarPage(props: {
  scope: CommandPartnerPortalScope;
  account: CommandPartnerPortalAccount;
}) {
  const [applications, setApplications] = useState<CommandPartnerPortalApplication[]>([]);
  const [availableEvents, setAvailableEvents] = useState<CommandPartnerPortalEventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [entries, setEntries] = useState<CommandPartnerAvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [calendarReady, setCalendarReady] = useState(false);
  const [calendarPlugins, setCalendarPlugins] = useState<any[]>([]);

  // Load FullCalendar plugins on client side
  useEffect(() => {
    async function loadPlugins() {
      const [dgModule, intModule] = await Promise.all([
        import("@fullcalendar/daygrid"),
        import("@fullcalendar/interaction"),
      ]);
      setCalendarPlugins([dgModule.default, intModule.default]);
      setCalendarReady(true);
    }
    void loadPlugins();
  }, []);

  // Load approved applications to populate event selector
  useEffect(() => {
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
        const apps = (payload.applications || []) as CommandPartnerPortalApplication[];
        const events = (payload.availableEvents || []) as CommandPartnerPortalEventOption[];
        setApplications(apps);
        setAvailableEvents(events);

        // Auto-select the first approved application's event
        const approvedApp = apps.find((a) => a.status === "APPROVED");
        if (approvedApp) {
          setSelectedEventId(approvedApp.event.id);
        }
      } catch (nextError: any) {
        setError(nextError?.message || "Failed to load applications.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [props.scope]);

  // Load availability when event selection changes
  useEffect(() => {
    if (!selectedEventId) {
      setEntries([]);
      return;
    }

    async function loadAvailability() {
      setLoadingAvailability(true);
      setError("");
      try {
        const response = await fetch(
          `/api/bff/${props.scope}/availability?eventSeriesId=${encodeURIComponent(selectedEventId)}`
        );
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          window.location.assign(`/${props.scope}/signin?error=SessionExpired`);
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Failed to load availability.");
        }
        setEntries(payload.entries || []);
      } catch (nextError: any) {
        setError(nextError?.message || "Failed to load availability.");
      } finally {
        setLoadingAvailability(false);
      }
    }
    void loadAvailability();
  }, [selectedEventId, props.scope]);

  // Toggle a date's availability
  const handleDateClick = useCallback(
    async (info: { dateStr: string }) => {
      if (!selectedEventId || saving) return;
      const dateStr = info.dateStr;

      const existing = entries.find((e) => e.date === dateStr);
      const isCurrentlyAvailable = existing?.available || false;

      // Optimistic update
      setEntries((prev) => {
        if (isCurrentlyAvailable) {
          return prev.map((e) => (e.date === dateStr ? { ...e, available: false } : e)).filter((e) => e.available || e.assigned);
        }
        const exists = prev.find((e) => e.date === dateStr);
        if (exists) {
          return prev.map((e) => (e.date === dateStr ? { ...e, available: true } : e));
        }
        return [...prev, { date: dateStr, available: true, assigned: false }].sort((a, b) => a.date.localeCompare(b.date));
      });

      setSaving(true);
      setNotice("");
      setError("");
      try {
        const response = await fetch(`/api/bff/${props.scope}/availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSeriesId: selectedEventId,
            dates: [dateStr],
            action: isCurrentlyAvailable ? "remove" : "set",
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Failed to update availability.");
        }
        setNotice(isCurrentlyAvailable ? "Date removed from availability." : "Date added to availability.");
      } catch (nextError: any) {
        // Revert optimistic update
        setEntries((prev) => {
          if (isCurrentlyAvailable) {
            const exists = prev.find((e) => e.date === dateStr);
            if (exists) {
              return prev.map((e) => (e.date === dateStr ? { ...e, available: true } : e));
            }
            return [...prev, { date: dateStr, available: true, assigned: false }].sort((a, b) => a.date.localeCompare(b.date));
          }
          return prev.map((e) => (e.date === dateStr ? { ...e, available: false } : e)).filter((e) => e.available || e.assigned);
        });
        setError(nextError?.message || "Failed to update availability.");
      } finally {
        setSaving(false);
      }
    },
    [selectedEventId, entries, saving, props.scope]
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch(`/api/bff/${props.scope}/auth/logout`, { method: "POST" });
    } finally {
      window.location.assign(`/${props.scope}/signin`);
    }
  }

  // Build calendar events from entries
  const calendarEvents: CalendarEvent[] = entries
    .filter((e) => e.available || e.assigned)
    .map((e) => {
      if (e.assigned) {
        return {
          id: `assigned-${e.date}`,
          title: "Assigned",
          start: e.date,
          allDay: true,
          display: "background",
          backgroundColor: "rgba(239, 68, 68, 0.25)",
          borderColor: "rgba(239, 68, 68, 0.4)",
        };
      }
      return {
        id: `available-${e.date}`,
        title: "Available",
        start: e.date,
        allDay: true,
        display: "background",
        backgroundColor: "rgba(34, 197, 94, 0.25)",
        borderColor: "rgba(34, 197, 94, 0.4)",
      };
    });

  // Get approved event options for the selector
  const approvedEventIds = new Set(
    applications.filter((a) => a.status === "APPROVED").map((a) => a.event.id)
  );
  const eventOptions = availableEvents.filter((e) => approvedEventIds.has(e.id));

  return (
    <PortalShell
      title="Availability Calendar"
      subtitle="Select dates you are available for each event."
      width="wide"
    >
      <PortalNav
        scope={props.scope}
        active="calendar"
        displayName={props.account.displayName}
        onSignOut={handleSignOut}
        busy={signingOut}
      />

      <div className="mt-6 grid gap-6">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
        ) : null}

        {loading ? (
          <div className="text-sm text-neutral-600">Loading events…</div>
        ) : eventOptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
            No approved applications found. You must have an approved application for an event before managing availability.
          </div>
        ) : (
          <>
            {/* Event selector */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-neutral-900" htmlFor="event-select">
                Event
              </label>
              <select
                id="event-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">Select an event…</option>
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Calendar */}
            {selectedEventId && calendarReady ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                {loadingAvailability ? (
                  <div className="text-sm text-neutral-600">Loading availability…</div>
                ) : (
                  <>
                    <FullCalendar
                      plugins={calendarPlugins}
                      initialView="dayGridMonth"
                      events={calendarEvents}
                      dateClick={handleDateClick}
                      height={520}
                      headerToolbar={{
                        left: "prev,next today",
                        center: "title",
                        right: "",
                      }}
                      editable={false}
                      selectable={false}
                    />
                    {saving ? (
                      <div className="mt-3 text-xs text-neutral-500">Saving…</div>
                    ) : null}
                  </>
                )}

                {/* Color legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-neutral-100 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: "rgba(34, 197, 94, 0.35)" }} />
                    <span className="text-xs text-neutral-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.35)" }} />
                    <span className="text-xs text-neutral-600">Assigned</span>
                  </div>
                  <div className="text-xs text-neutral-500">Click a date to toggle your availability.</div>
                </div>
              </div>
            ) : selectedEventId ? (
              <div className="text-sm text-neutral-600">Loading calendar…</div>
            ) : null}
          </>
        )}
      </div>
    </PortalShell>
  );
}
