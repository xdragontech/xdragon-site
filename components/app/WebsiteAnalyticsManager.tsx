import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CommandPublicAnalyticsConsentNotice, CommandPublicAnalyticsEvent } from "../../lib/commandPublicApi";

type ConsentState = {
  status: "unknown" | "accepted" | "declined";
  version: number | null;
  decidedAt: number | null;
};

type AnalyticsConfigResponse = {
  ok: true;
  notice: CommandPublicAnalyticsConsentNotice;
  consent: ConsentState;
};

const HEARTBEAT_SECONDS = 10;

function nextEventId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function currentLocationState() {
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

function buildEvent(
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

async function postEvents(events: CommandPublicAnalyticsEvent[]) {
  await fetch("/api/analytics/collect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
    cache: "no-store",
  });
}

function sendBeaconEvents(events: CommandPublicAnalyticsEvent[]) {
  const payload = JSON.stringify({ events });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/collect", blob);
    return;
  }

  void fetch("/api/analytics/collect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    cache: "no-store",
    keepalive: true,
  });
}

export default function WebsiteAnalyticsManager() {
  const router = useRouter();
  const [config, setConfig] = useState<AnalyticsConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const lastTrackedPathRef = useRef<string | null>(null);
  const initialRefererRef = useRef<string | null>(null);

  const trackingEnabled = Boolean(
    config?.notice &&
      config?.consent.status === "accepted" &&
      config?.consent.version === config?.notice.version
  );

  const bannerVisible = Boolean(config?.notice && config?.consent.status === "unknown");

  const currentPath = useMemo(() => router.asPath || "", [router.asPath]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      initialRefererRef.current = document.referrer || null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setLoading(true);

      try {
        const res = await fetch("/api/analytics/config", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || "Failed to load analytics config");
        }

        if (!cancelled) {
          setConfig(payload as AnalyticsConfigResponse);
        }
      } catch (error) {
        console.error("[website-analytics] failed to load config", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trackingEnabled || loading) return;
    if (currentPath === lastTrackedPathRef.current) return;

    const referer = lastTrackedPathRef.current ? null : initialRefererRef.current;
    lastTrackedPathRef.current = currentPath;

    void postEvents([
      buildEvent("PAGE_VIEW", {
        referer,
      }),
    ]);
  }, [currentPath, loading, trackingEnabled]);

  useEffect(() => {
    if (!trackingEnabled) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      void postEvents([
        buildEvent("ENGAGEMENT_PING", {
          engagedSeconds: HEARTBEAT_SECONDS,
          raw: {
            visibilityState: document.visibilityState,
          },
        }),
      ]);
    }, HEARTBEAT_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [trackingEnabled]);

  useEffect(() => {
    if (!trackingEnabled) return;

    const handlePageHide = () => {
      sendBeaconEvents([
        buildEvent("SESSION_END", {
          raw: {
            trigger: "pagehide",
          },
        }),
      ]);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [trackingEnabled]);

  async function submitConsent(decision: "accepted" | "declined") {
    if (!config?.notice) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/analytics/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          version: config.notice.version,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to save analytics consent");
      }

      setConfig(payload as AnalyticsConfigResponse);
      if (decision === "accepted") {
        lastTrackedPathRef.current = null;
      }
    } catch (error) {
      console.error("[website-analytics] failed to save consent", error);
    } finally {
      setSubmitting(false);
    }
  }

  if (!bannerVisible || !config?.notice) return null;

  return (
    <div style={bannerShellStyle}>
      <div style={bannerCardStyle}>
        <div style={titleStyle}>{config.notice.title}</div>
        <div style={messageStyle}>{config.notice.message}</div>
        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={() => void submitConsent("declined")}
            disabled={submitting}
            style={secondaryButtonStyle}
          >
            {config.notice.declineLabel}
          </button>
          <button
            type="button"
            onClick={() => void submitConsent("accepted")}
            disabled={submitting}
            style={primaryButtonStyle}
          >
            {config.notice.acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const bannerShellStyle: CSSProperties = {
  position: "fixed",
  left: "16px",
  bottom: "16px",
  zIndex: 120,
  width: "min(560px, calc(100vw - 32px))",
};

const bannerCardStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(15,23,42,0.12)",
  background: "rgba(255,255,255,0.98)",
  boxShadow: "0 20px 40px rgba(15,23,42,0.16)",
  padding: "18px 20px",
  display: "grid",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "#0f172a",
};

const messageStyle: CSSProperties = {
  fontSize: "0.94rem",
  lineHeight: 1.55,
  color: "#475569",
  whiteSpace: "pre-line",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "10px 16px",
  background: "#111827",
  color: "#fff",
  fontSize: "0.88rem",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.38)",
  borderRadius: "999px",
  padding: "10px 16px",
  background: "#fff",
  color: "#0f172a",
  fontSize: "0.88rem",
  fontWeight: 700,
  cursor: "pointer",
};
