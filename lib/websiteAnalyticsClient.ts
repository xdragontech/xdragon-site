import type { CommandPublicAnalyticsEvent } from "./commandPublicApi";

const CONSENT_COOKIE_CANDIDATES = [
  "__Secure-stg-cmd-web-consent",
  "__Secure-cmd-web-consent",
  "cmd-web-consent",
] as const;

let pendingEvents: CommandPublicAnalyticsEvent[] = [];
let pendingFlushHandle: number | null = null;

function nextEventId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function currentLocationState() {
  if (typeof window === "undefined") {
    return {
      path: null,
      url: null,
    };
  }

  return {
    path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    url: window.location.href,
  };
}

export function buildWebsiteAnalyticsEvent(
  eventType: CommandPublicAnalyticsEvent["eventType"],
  extras?: Partial<CommandPublicAnalyticsEvent>
): CommandPublicAnalyticsEvent {
  const location = currentLocationState();

  return {
    eventId: nextEventId(),
    eventType,
    occurredAt: new Date().toISOString(),
    path: location.path,
    url: location.url,
    ...extras,
  };
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;

  for (const chunk of document.cookie.split(";")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(trimmed.slice(separator + 1));
  }

  return null;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function getWebsiteAnalyticsConsentStatus() {
  if (typeof window === "undefined") return "unknown";

  for (const name of CONSENT_COOKIE_CANDIDATES) {
    const raw = readCookie(name);
    if (!raw) continue;

    try {
      const payload = JSON.parse(decodeBase64Url(raw)) as {
        status?: "accepted" | "declined" | "unknown";
      };
      if (payload.status === "accepted" || payload.status === "declined") {
        return payload.status;
      }
    } catch {
      continue;
    }
  }

  return "unknown";
}

async function postWebsiteAnalyticsEventsNow(events: CommandPublicAnalyticsEvent[]) {
  if (!events.length || getWebsiteAnalyticsConsentStatus() !== "accepted") return;

  await fetch("/api/analytics/collect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
    cache: "no-store",
    keepalive: true,
  });
}

async function flushQueuedWebsiteAnalyticsEvents() {
  pendingFlushHandle = null;
  if (!pendingEvents.length) return;

  const batch = pendingEvents;
  pendingEvents = [];

  try {
    await postWebsiteAnalyticsEventsNow(batch);
  } catch (error) {
    console.error("[website-analytics] failed to send queued analytics events", error);
  }
}

export function queueWebsiteAnalyticsEvents(events: CommandPublicAnalyticsEvent[]) {
  if (typeof window === "undefined") return;
  if (!events.length || getWebsiteAnalyticsConsentStatus() !== "accepted") return;

  pendingEvents.push(...events);
  if (pendingFlushHandle != null) return;

  pendingFlushHandle = window.setTimeout(() => {
    void flushQueuedWebsiteAnalyticsEvents();
  }, 150);
}
