import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicGetAnalyticsConsentNotice,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";
import {
  clearWebsiteAnalyticsSession,
  setWebsiteAnalyticsConsent,
} from "../../../lib/websiteAnalytics";

type ConsentDecision = "accepted" | "declined";

function parseDecision(value: unknown): ConsentDecision | null {
  return value === "accepted" || value === "declined" ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const decision = parseDecision(body.decision);
  const requestedVersion = Number.isInteger(body.version) ? body.version : null;

  if (!decision || !requestedVersion) {
    return res.status(400).json({ ok: false, error: "Consent decision and version are required" });
  }

  try {
    const result = await commandPublicGetAnalyticsConsentNotice({ request: req });
    if (result.notice.version !== requestedVersion) {
      return res.status(409).json({
        ok: false,
        error: "Consent notice version is stale. Refresh and retry.",
        notice: result.notice,
      });
    }

    clearWebsiteAnalyticsSession(res);
    setWebsiteAnalyticsConsent(res, {
      status: decision,
      version: result.notice.version,
      decidedAt: Date.now(),
    });

    return res.status(200).json({
      ok: true,
      notice: result.notice,
      consent: {
        status: decision,
        version: result.notice.version,
        decidedAt: Date.now(),
      },
    });
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
