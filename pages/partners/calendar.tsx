// HUMAN-REVIEW: Wave 12 — partner availability calendar page
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import PortalCalendarPage from "../../components/partnerPortal/PortalCalendarPage";
import { requirePartnerPortalPageSession } from "../../lib/partnerPortalPage";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const result = await requirePartnerPortalPageSession(ctx, "partners");
  if ("redirect" in result) return result;
  return {
    props: {
      account: result.account,
    },
  };
};

export default function PartnerCalendarRoute({
  account,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <PortalCalendarPage scope="partners" account={account} />;
}
