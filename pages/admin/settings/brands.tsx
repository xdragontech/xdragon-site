import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import AdminRetiredSurfacePage from "../../../components/admin/AdminRetiredSurfacePage";
import {
  getRetiredAdminSurfaceProps,
  type RetiredAdminSurfacePageProps,
} from "../../../lib/adminRetiredSurface";

export const getServerSideProps: GetServerSideProps<RetiredAdminSurfacePageProps> = async (ctx) =>
  getRetiredAdminSurfaceProps(ctx, "/admin/settings/brands");

export default function BrandsRetiredPage({
  targetUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <AdminRetiredSurfacePage
      title="Brand management moved"
      description="Brand management is no longer owned by xdragon-site. Use the Command backoffice for brand and host registry changes."
      targetUrl={targetUrl}
      actionLabel="Open Command Brands"
    />
  );
}
