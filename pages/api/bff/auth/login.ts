import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicLogin,
  isCommandPublicApiEnabled,
  CommandPublicApiError,
  logCommandPublicApiError,
} from "../../../../lib/commandPublicApi";
import { setCommandBffSessionCookie } from "../../../../lib/commandBffSession";
import { getWebsiteAnalyticsSessionId } from "../../../../lib/websiteAnalytics";
import { recordWebsiteRequestPerformance } from "../../../../lib/websitePerformance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isCommandPublicApiEnabled()) {
    return res.status(503).json({ ok: false, error: "Command public API is not configured" });
  }

  const startedAt = performance.now();
  let statusCode: number | undefined;

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const result = await commandPublicLogin({
      email,
      password: String(req.body?.password || ""),
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    setCommandBffSessionCookie(res, result.session);

    statusCode = 200;
    return res.status(statusCode).json({
      ok: true,
      account: result.account,
    });
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError("bff-auth-login", error, {
        requestHost: req.headers.host || null,
        emailDomain: String(req.body?.email || "").includes("@")
          ? String(req.body?.email || "").trim().toLowerCase().split("@")[1] || null
          : null,
      });
      statusCode = error.status;
      return res.status(statusCode).json({ ok: false, error: error.message });
    }

    console.error("[bff-auth-login] unexpected error", error);
    statusCode = 500;
    return res.status(statusCode).json({ ok: false, error: "Server error" });
  } finally {
    await recordWebsiteRequestPerformance({
      req,
      routeKey: "LOGIN",
      durationMs: performance.now() - startedAt,
      statusCode,
    });
  }
}
