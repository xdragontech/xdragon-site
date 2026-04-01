import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicGetScheduleFeed,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";

function getSchedulePageFeedId() {
  return String(process.env.SCHEDULE_PAGE_FEED_ID || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const feedId = getSchedulePageFeedId();
  if (!feedId) {
    return res.status(503).json({ ok: false, error: "Schedule feed is not configured" });
  }

  try {
    const response = await commandPublicGetScheduleFeed({
      feedId,
      request: req,
    });

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
