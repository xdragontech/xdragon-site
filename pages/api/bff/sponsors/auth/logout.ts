import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalLogout } from "../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalLogout(req, res, "sponsors");
}
