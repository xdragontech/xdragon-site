import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalProfileImage } from "../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalProfileImage(req, res, "partners");
}
