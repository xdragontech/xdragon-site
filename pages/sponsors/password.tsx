import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import PortalPasswordPage from "../../components/partnerPortal/PortalPasswordPage";
import { requirePartnerPortalPageSession } from "../../lib/partnerPortalPage";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const result = await requirePartnerPortalPageSession(ctx, "sponsors", {
    allowPasswordChangePage: true,
  });
  if ("redirect" in result) return result;
  return {
    props: {
      account: result.account,
    },
  };
};

export default function SponsorPasswordRoute({
  account,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <PortalPasswordPage scope="sponsors" account={account} />;
}
