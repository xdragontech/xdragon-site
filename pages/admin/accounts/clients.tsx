import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import AdminRetiredSurfacePage from "../../../components/admin/AdminRetiredSurfacePage";
import {
  getRetiredAdminSurfaceProps,
  type RetiredAdminSurfacePageProps,
} from "../../../lib/adminRetiredSurface";

export const getServerSideProps: GetServerSideProps<RetiredAdminSurfacePageProps> = async (ctx) =>
  getRetiredAdminSurfaceProps(ctx, "/admin/accounts/clients");

export default function ClientAccountsRetiredPage({
  targetUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <AdminRetiredSurfacePage
      title="Client accounts moved"
      description="Client account management is no longer owned by xdragon-site. Use the Command backoffice for client account changes."
      targetUrl={targetUrl}
      actionLabel="Open Command Client Accounts"
    />
  );
}
