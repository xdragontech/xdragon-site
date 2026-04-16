// HUMAN-REVIEW: Wave 12 — partner availability calendar BFF route
import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalAvailability } from "../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalAvailability(req, res, "partners");
}
