import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalVerifyEmail } from "../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalVerifyEmail(req, res, "sponsors");
}
