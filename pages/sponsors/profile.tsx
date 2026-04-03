import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import PortalProfilePage from "../../components/partnerPortal/PortalProfilePage";
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

export default function SponsorProfileRoute({
  account,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <PortalProfilePage scope="sponsors" account={account} />;
}
