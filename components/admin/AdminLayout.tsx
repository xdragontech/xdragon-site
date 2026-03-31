import type { ReactNode } from "react";
import WorkspaceLayout from "../backoffice/WorkspaceLayout";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

type AdminLayoutProps = {
  title?: string;
  sectionLabel: string;
  loggedInAs?: string | null;
  active: "dashboard" | "accounts" | "library" | "leads" | "settings";
  children: ReactNode;
};

export default function AdminLayout({ title, sectionLabel, loggedInAs, active, children }: AdminLayoutProps) {
  return (
    <WorkspaceLayout
      title={title}
      header={<AdminHeader sectionLabel={sectionLabel} loggedInAs={loggedInAs} />}
      sidebar={<AdminSidebar active={active} />}
    >
      {children}
    </WorkspaceLayout>
  );
}
