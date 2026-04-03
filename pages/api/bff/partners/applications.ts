import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalApplications } from "../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalApplications(req, res, "partners");
}
