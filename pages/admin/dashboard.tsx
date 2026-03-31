import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import AdminRetiredSurfacePage from "../../components/admin/AdminRetiredSurfacePage";
import {
  getRetiredAdminSurfaceProps,
  type RetiredAdminSurfacePageProps,
} from "../../lib/adminRetiredSurface";

export const getServerSideProps: GetServerSideProps<RetiredAdminSurfacePageProps> = async (ctx) =>
  getRetiredAdminSurfaceProps(ctx, "/admin/dashboard");

export default function DashboardRetiredPage({
  targetUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <AdminRetiredSurfacePage
      title="Dashboard moved"
      description="The xdragon-site dashboard metrics surface has been retired. Use the Command backoffice for current dashboard reporting."
      targetUrl={targetUrl}
      actionLabel="Open Command Dashboard"
    />
  );
}
