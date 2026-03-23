import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicListScheduleList,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";

function parseLimit(value: unknown) {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const response = await commandPublicListScheduleList({
      date: typeof req.query.date === "string" ? req.query.date : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      occurrenceDate: typeof req.query.occurrenceDate === "string" ? req.query.occurrenceDate : undefined,
      eventSeries: typeof req.query.eventSeries === "string" ? req.query.eventSeries : undefined,
      participantType: typeof req.query.participantType === "string" ? req.query.participantType : undefined,
      resource: typeof req.query.resource === "string" ? req.query.resource : undefined,
      location: typeof req.query.location === "string" ? req.query.location : undefined,
      resourceType: typeof req.query.resourceType === "string" ? req.query.resourceType : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      sequence: typeof req.query.sequence === "string" ? req.query.sequence : undefined,
      limit: parseLimit(req.query.limit),
    });

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
