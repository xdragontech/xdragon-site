import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicCollectAnalytics,
  type CommandPublicAnalyticsEvent,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";
import {
  ensureWebsiteAnalyticsSession,
  getWebsiteAnalyticsConsent,
} from "../../../lib/websiteAnalytics";

function normalizeBody(raw: unknown) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return raw && typeof raw === "object" ? raw : {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSyntheticSessionStart(source: Record<string, unknown>): CommandPublicAnalyticsEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType: "SESSION_START",
    occurredAt: getString(source.occurredAt) || new Date().toISOString(),
    path: getString(source.path),
    url: getString(source.url),
    referer: getString(source.referer),
    utmSource: getString(source.utmSource),
    utmMedium: getString(source.utmMedium),
    utmCampaign: getString(source.utmCampaign),
    utmTerm: getString(source.utmTerm),
    utmContent: getString(source.utmContent),
    gclid: getString(source.gclid),
    fbclid: getString(source.fbclid),
    msclkid: getString(source.msclkid),
    ttclid: getString(source.ttclid),
    raw: {
      generatedBy: "xdragon-site",
      reason: "session-bootstrap",
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const consent = getWebsiteAnalyticsConsent(req);
  if (consent.status !== "accepted" || !consent.version) {
    return res.status(202).json({ ok: true, ignored: true });
  }

  const body = normalizeBody(req.body);
  const events = Array.isArray((body as any).events) ? ([...(body as any).events] as Record<string, unknown>[]) : [];
  if (!events.length) {
    return res.status(400).json({ ok: false, error: "At least one analytics event is required" });
  }

  try {
    const session = ensureWebsiteAnalyticsSession(req, res, consent.version);
    const hasSessionStart = events.some((event) => getString(event?.eventType) === "SESSION_START");
    const commandEvents = (session.isNewSession && !hasSessionStart
      ? [buildSyntheticSessionStart(events[0] || {}), ...events]
      : events) as CommandPublicAnalyticsEvent[];

    const result = await commandPublicCollectAnalytics({
      events: commandEvents,
      websiteSessionId: session.sessionId,
      request: req,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
