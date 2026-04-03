import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalProfile } from "../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalProfile(req, res, "sponsors");
}
