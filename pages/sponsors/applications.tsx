import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import PortalApplicationsPage from "../../components/partnerPortal/PortalApplicationsPage";
import { requirePartnerPortalPageSession } from "../../lib/partnerPortalPage";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const result = await requirePartnerPortalPageSession(ctx, "sponsors");
  if ("redirect" in result) return result;
  return {
    props: {
      account: result.account,
    },
  };
};

export default function SponsorApplicationsRoute({
  account,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <PortalApplicationsPage scope="sponsors" account={account} />;
}
