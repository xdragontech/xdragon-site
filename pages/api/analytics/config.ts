import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicGetAnalyticsConsentNotice,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";
import {
  invalidateWebsiteAnalyticsIfVersionChanged,
} from "../../../lib/websiteAnalytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicGetAnalyticsConsentNotice({ request: req });
    const consent = invalidateWebsiteAnalyticsIfVersionChanged(req, res, result.notice.version);

    return res.status(200).json({
      ok: true,
      notice: result.notice,
      consent,
    });
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
