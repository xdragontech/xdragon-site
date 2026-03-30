import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicChat,
  CommandPublicApiError,
} from "../../lib/commandPublicApi";
import { getWebsiteAnalyticsSessionId } from "../../lib/websiteAnalytics";
import { recordWebsiteRequestPerformance } from "../../lib/websitePerformance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = performance.now();
  let statusCode: number | undefined;

  try {
    const result = await commandPublicChat({
      conversationId:
        typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
      messages: Array.isArray(req.body?.messages) ? req.body.messages : [],
      lead: req.body?.lead || {},
      emailed: Boolean(req.body?.emailed),
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    statusCode = result.ok ? 200 : 500;
    return res.status(statusCode).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      statusCode = error.status;
      return res.status(statusCode).json({ ok: false, error: error.message });
    }

    statusCode = 500;
    return res.status(statusCode).json({ ok: false, error: "Server error" });
  } finally {
    await recordWebsiteRequestPerformance({
      req,
      routeKey: "CHAT",
      durationMs: performance.now() - startedAt,
      statusCode,
    });
  }
}
