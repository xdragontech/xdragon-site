import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import AdminRetiredSurfacePage from "../../components/admin/AdminRetiredSurfacePage";
import {
  getRetiredAdminSurfaceProps,
  type RetiredAdminSurfacePageProps,
} from "../../lib/adminRetiredSurface";

export const getServerSideProps: GetServerSideProps<RetiredAdminSurfacePageProps> = async (ctx) =>
  getRetiredAdminSurfaceProps(ctx, "/admin/analytics");

export default function AnalyticsRetiredPage({
  targetUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <AdminRetiredSurfacePage
      title="Analytics moved"
      description="The xdragon-site analytics and login-geo backfill surface has been retired. Use the Command backoffice for current reporting."
      targetUrl={targetUrl}
      actionLabel="Open Command Analytics"
    />
  );
}
